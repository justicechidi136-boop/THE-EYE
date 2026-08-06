import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import type { JwtPayload } from "../../common/auth/jwt";
import {
  buildCursorPage,
  dateIdCursorWhere,
  decodeDateIdCursor,
  encodeDateIdCursor,
  resolvePageLimit,
  type CursorPageQuery,
} from "../../common/pagination/cursor-pagination";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { buildIncidentInformationRequestNotificationMetadata, buildIncidentMessageNotificationMetadata } from "../notifications/notification-routing.schema";
import { PrismaService } from "../prisma/prisma.service";
import { isActiveIncidentStatus, isTerminalIncidentStatus } from "../incidents/incident-lifecycle";
import {
  CloseConversationDto,
  CreateInformationRequestDto,
  ReportMessageDto,
  RestrictConversationDto,
  SendIncidentMessageDto,
  validateSendIncidentMessageDto,
} from "./dto/incident-communications.dto";
import {
  defaultAllowedReplyTypes,
  informationRequestPrompt,
  INFORMATION_REQUEST_TYPES,
  type InformationRequestType,
} from "./information-requests.catalog";
import {
  IncidentCommunicationsAccessService,
  type IncidentCommunicationAccess,
} from "./incident-communications-access.service";

const CLOSED_CONVERSATION = new Set(["Closed", "Archived"]);

@Injectable()
export class IncidentCommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: IncidentCommunicationsAccessService,
    private readonly audit: AuditService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async getConversation(incidentId: string, actor: JwtPayload) {
    const ctx = await this.access.assertAccess(incidentId, actor);
    const conversation = await this.ensureConversation(incidentId);
    const summary = await this.buildSummary(conversation, ctx, actor);
    return { data: { ...this.mapConversation(conversation), ...summary } };
  }

  async listMessages(
    incidentId: string,
    actor: JwtPayload,
    query: CursorPageQuery,
  ) {
    const ctx = await this.access.assertAccess(incidentId, actor);
    const conversation = await this.ensureConversation(incidentId);
    const cursor = query.cursor ? decodeDateIdCursor(query.cursor) : undefined;
    const limit = resolvePageLimit(query.limit, 30, 100);
    const where = {
      conversationId: conversation.id,
      deletedAt: null,
      ...(ctx.canReadInternal ? {} : { isInternal: false }),
      ...dateIdCursorWhere(cursor),
    };
    const rows = await this.prisma.incidentMessage.findMany({
      where: where as never,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        receipts: {
          where: this.receiptFilter(actor),
          take: 5,
        },
      },
    });
    const page = buildCursorPage(rows, limit, (row) =>
      encodeDateIdCursor(row.createdAt, row.id),
    );
    return {
      data: page.items.map((row) => this.mapMessage(row, ctx)),
      pageInfo: page.pageInfo,
      conversationStatus: conversation.status,
      readOnly: this.isReadOnly(conversation, ctx.incident.status),
    };
  }

  async sendMessage(incidentId: string, actor: JwtPayload, dto: SendIncidentMessageDto) {
    const ctx = await this.access.assertAccess(incidentId, actor);
    if (!ctx.canWrite) {
      throw new NotFoundException("Incident not found or outside your scope");
    }
    const conversation = await this.ensureConversation(incidentId);
    this.assertCanSend(conversation, ctx);
    this.assertMessageTypeWhenRestricted(dto.messageType, ctx, conversation.status);
    const official = ctx.role !== "Reporter";
    validateSendIncidentMessageDto(dto, official);
    if (!this.access.canSendMessageType(ctx, dto.messageType, official)) {
      throw new BadRequestException(`Message type ${dto.messageType} is not permitted for your role`);
    }

    const existing = dto.clientMessageId
      ? await this.prisma.incidentMessage.findFirst({
          where: { conversationId: conversation.id, clientMessageId: dto.clientMessageId },
        })
      : null;
    if (existing) {
      return { data: this.mapMessage(existing, ctx), duplicate: true };
    }

    const body =
      dto.body?.trim() ||
      (dto.messageType === "QuickReply"
        ? String((dto.structuredAction as Record<string, unknown>)?.action ?? "Quick reply")
        : dto.messageType === "LocationUpdate"
          ? "Location update"
          : `[${dto.messageType}]`);

    const message = await this.prisma.incidentMessage.create({
      data: {
        conversationId: conversation.id,
        incidentId,
        senderUserId: actor.typ === "user" ? actor.sub : undefined,
        senderAdminId: actor.typ === "admin" ? actor.sub : undefined,
        senderRole: ctx.senderRole,
        senderAgencyId: ctx.senderAgencyId,
        senderResponderId: ctx.senderResponderId,
        messageType: dto.messageType as never,
        body,
        attachmentId: dto.attachmentId,
        structuredAction: dto.structuredAction as never,
        replyToMessageId: dto.replyToMessageId,
        clientMessageId: dto.clientMessageId,
        metadata: (dto.metadata ?? {}) as never,
        moderationStatus: "Approved",
      },
    });

    await this.prisma.incidentConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: message.createdAt, version: { increment: 1 } },
    });

    await this.createDeliveryReceipts(message.id, incidentId, actor);
    await this.notifyRecipients(incidentId, message.id, ctx, dto.messageType);
    await this.audit.record({
      actor,
      action: "communication.message_sent",
      entityType: "incident_message",
      entityId: message.id,
      metadata: {
        incidentId,
        conversationId: conversation.id,
        messageType: dto.messageType,
        senderRole: ctx.senderRole,
      },
    });

    if (dto.messageType === "QuickReply" && dto.structuredAction) {
      await this.tryResolveInformationRequest(
        incidentId,
        dto.structuredAction as Record<string, unknown>,
        message.id,
      );
    }

    return { data: this.mapMessage(message, ctx) };
  }

  async markRead(incidentId: string, messageId: string, actor: JwtPayload) {
    const ctx = await this.access.assertAccess(incidentId, actor);
    const message = await this.prisma.incidentMessage.findFirst({
      where: { id: messageId, incidentId },
    });
    if (!message) throw new NotFoundException("Message not found");
    const now = new Date();
    const filter = this.receiptFilter(actor);
    await this.prisma.incidentMessageReceipt.updateMany({
      where: { messageId, ...filter, readAt: null },
      data: { readAt: now, deliveredAt: now },
    });
    await this.audit.record({
      actor,
      action: "communication.message_read",
      entityType: "incident_message",
      entityId: messageId,
      metadata: { incidentId, senderRole: ctx.senderRole },
    });
    return { data: { messageId, readAt: now.toISOString() } };
  }

  async reportMessage(incidentId: string, messageId: string, actor: JwtPayload, dto: ReportMessageDto) {
    await this.access.assertAccess(incidentId, actor);
    const message = await this.prisma.incidentMessage.findFirst({
      where: { id: messageId, incidentId, deletedAt: null },
    });
    if (!message) throw new NotFoundException("Message not found");
    await this.prisma.incidentMessage.update({
      where: { id: messageId },
      data: {
        moderationStatus: "Flagged",
        metadata: {
          ...(message.metadata as object),
          reportReason: dto.reason,
          reportDetails: dto.details ?? null,
          reportedAt: new Date().toISOString(),
        } as never,
      },
    });
    await this.audit.record({
      actor,
      action: "communication.message_reported",
      entityType: "incident_message",
      entityId: messageId,
      reason: dto.reason,
      metadata: { incidentId },
    });
    return { data: { messageId, moderationStatus: "Flagged" } };
  }

  async restrictConversation(incidentId: string, actor: JwtPayload, dto: RestrictConversationDto) {
    const ctx = await this.access.assertAccess(incidentId, actor);
    if (!ctx.canModerate) throw new ForbiddenException("Not permitted to restrict conversation");
    const conversation = await this.ensureConversation(incidentId);
    const updated = await this.prisma.incidentConversation.update({
      where: { id: conversation.id },
      data: { status: "Restricted", version: { increment: 1 } },
    });
    await this.audit.record({
      actor,
      action: "communication.restrict",
      entityType: "incident_conversation",
      entityId: conversation.id,
      reason: dto.reason,
      metadata: { incidentId },
    });
    return { data: this.mapConversation(updated) };
  }

  async closeConversation(incidentId: string, actor: JwtPayload, dto: CloseConversationDto) {
    const ctx = await this.access.assertAccess(incidentId, actor);
    if (!ctx.canModerate && ctx.role !== "Dispatcher") {
      throw new ForbiddenException("Not permitted to close conversation");
    }
    const conversation = await this.ensureConversation(incidentId);
    const now = new Date();
    const updated = await this.prisma.incidentConversation.update({
      where: { id: conversation.id },
      data: {
        status: "Closed",
        closedAt: now,
        closedById: actor.sub,
        closeReason: dto.reason ?? "Closed by operator",
        version: { increment: 1 },
      },
    });
    await this.audit.record({
      actor,
      action: "communication.close",
      entityType: "incident_conversation",
      entityId: conversation.id,
      reason: dto.reason,
      metadata: { incidentId },
    });
    return { data: this.mapConversation(updated) };
  }

  async createInformationRequest(
    incidentId: string,
    actor: JwtPayload,
    dto: CreateInformationRequestDto,
  ) {
    const ctx = await this.access.assertAccess(incidentId, actor);
    if (!ctx.canModerate && ctx.role !== "Dispatcher" && ctx.role !== "Agency") {
      throw new ForbiddenException("Not permitted to request information");
    }
    const requestType = dto.requestType as InformationRequestType;
    if (!INFORMATION_REQUEST_TYPES.includes(requestType)) {
      throw new BadRequestException("Invalid information request type");
    }
    if (requestType === "custom_approved" && !dto.customPrompt?.trim()) {
      throw new BadRequestException("customPrompt is required for custom_approved requests");
    }
    const conversation = await this.ensureConversation(incidentId);
    const expiresAt = dto.expiresInMinutes
      ? new Date(Date.now() + dto.expiresInMinutes * 60_000)
      : new Date(Date.now() + 30 * 60_000);
    const prompt = informationRequestPrompt(requestType, dto.customPrompt);
    const request = await this.prisma.incidentInformationRequest.create({
      data: {
        conversationId: conversation.id,
        incidentId,
        requestType,
        prompt,
        allowedReplyTypes: defaultAllowedReplyTypes(requestType) as never,
        required: dto.required ?? false,
        expiresAt,
        requestedByAdminId: actor.typ === "admin" ? actor.sub : undefined,
        status: "Open",
      },
    });

    const message = await this.sendMessage(incidentId, actor, {
      clientMessageId: `info-req-${request.id}`,
      messageType: "InformationRequest",
      body: prompt,
      structuredAction: { requestId: request.id, requestType },
      metadata: { informationRequestId: request.id },
    });

    await this.notifyInformationRequest(incidentId, request.id, ctx.incident.status);
    await this.audit.record({
      actor,
      action: "communication.information_request",
      entityType: "incident_information_request",
      entityId: request.id,
      metadata: { incidentId, requestType },
    });

    return { data: { request: this.mapInformationRequest(request), message: message.data } };
  }

  async getCommunicationSummary(incidentId: string, actor: JwtPayload) {
    const ctx = await this.access.assertAccess(incidentId, actor);
    const conversation = await this.prisma.incidentConversation.findUnique({
      where: { incidentId },
    });
    if (!conversation) {
      return {
        conversationAvailable: isActiveIncidentStatus(ctx.incident.status as never),
        unreadMessageCount: 0,
        lastMessagePreview: null,
        lastMessageAt: null,
        pendingInformationRequestCount: 0,
        conversationStatus: "Active",
        allowedCommunicationActions: this.allowedActions(conversation, ctx),
      };
    }
    return this.buildSummary(conversation, ctx, actor);
  }

  private async buildSummary(
    conversation: { id: string; status: string; lastMessageAt: Date | null },
    ctx: IncidentCommunicationAccess,
    actor: JwtPayload,
  ) {
    const unread = await this.prisma.incidentMessageReceipt.count({
      where: {
        readAt: null,
        failedAt: null,
        message: {
          conversationId: conversation.id,
          deletedAt: null,
          ...(ctx.canReadInternal ? {} : { isInternal: false }),
        },
        ...this.receiptFilter(actor),
      },
    });
    const lastMessage = await this.prisma.incidentMessage.findFirst({
      where: {
        conversationId: conversation.id,
        deletedAt: null,
        ...(ctx.canReadInternal ? {} : { isInternal: false }),
      },
      orderBy: { createdAt: "desc" },
    });
    const pendingRequests = await this.prisma.incidentInformationRequest.count({
      where: {
        conversationId: conversation.id,
        status: "Open",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    return {
      conversationAvailable: true,
      unreadMessageCount: unread,
      lastMessagePreview: lastMessage ? this.safePreview(lastMessage) : null,
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      pendingInformationRequestCount: pendingRequests,
      conversationStatus: conversation.status,
      allowedCommunicationActions: this.allowedActions(conversation, ctx),
    };
  }

  private allowedActions(
    conversation: { status: string } | null,
    ctx: IncidentCommunicationAccess,
  ) {
    const readOnly =
      !conversation ||
      CLOSED_CONVERSATION.has(conversation.status) ||
      isTerminalIncidentStatus(ctx.incident.status as never);
    if (readOnly || !ctx.canWrite) {
      return {
        sendText: false,
        sendVoice: false,
        sendPhoto: false,
        sendVideo: false,
        sendLocation: false,
        quickReply: false,
        openThread: ctx.canRead,
      };
    }
    if (conversation?.status === "Restricted" && ctx.role === "Reporter") {
      return {
        sendText: false,
        sendVoice: true,
        sendPhoto: true,
        sendVideo: false,
        sendLocation: true,
        quickReply: true,
        openThread: true,
      };
    }
    return {
      sendText: true,
      sendVoice: true,
      sendPhoto: true,
      sendVideo: true,
      sendLocation: true,
      quickReply: true,
      openThread: true,
    };
  }

  private async ensureConversation(incidentId: string) {
    const existing = await this.prisma.incidentConversation.findUnique({ where: { incidentId } });
    if (existing) return existing;
    return this.prisma.incidentConversation.create({
      data: { incidentId, status: "Active" },
    });
  }

  private assertCanSend(
    conversation: { status: string },
    ctx: IncidentCommunicationAccess,
  ) {
    if (CLOSED_CONVERSATION.has(conversation.status)) {
      throw new BadRequestException("Conversation is closed");
    }
    if (isTerminalIncidentStatus(ctx.incident.status as never) && ctx.role === "Reporter") {
      throw new BadRequestException("Incident is resolved; communication is read-only");
    }
    if (conversation.status === "Restricted" && ctx.role === "Reporter") {
      return;
    }
  }

  private assertMessageTypeWhenRestricted(
    messageType: string,
    ctx: IncidentCommunicationAccess,
    conversationStatus: string,
  ) {
    if (conversationStatus !== "Restricted" || ctx.role !== "Reporter") return;
    const allowedWhenRestricted = new Set(["Voice", "Image", "QuickReply", "LocationUpdate"]);
    if (!allowedWhenRestricted.has(messageType)) {
      throw new BadRequestException("Conversation is restricted; this message type is not permitted");
    }
  }

  private isReadOnly(
    conversation: { status: string },
    incidentStatus: string,
  ) {
    return (
      CLOSED_CONVERSATION.has(conversation.status) ||
      isTerminalIncidentStatus(incidentStatus as never)
    );
  }

  private receiptFilter(actor: JwtPayload) {
    if (actor.typ === "user") return { recipientUserId: actor.sub };
    if (actor.typ === "admin") return { recipientAdminId: actor.sub };
    return { recipientUserId: "__none__" };
  }

  private async createDeliveryReceipts(messageId: string, incidentId: string, sender: JwtPayload) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: { reporterId: true, assignedAgencyId: true },
    });
    if (!incident) return;
    const now = new Date();
    const recipients: Array<{ recipientUserId?: string; recipientAdminId?: string }> = [];
    if (incident.reporterId && !(sender.typ === "user" && sender.sub === incident.reporterId)) {
      recipients.push({ recipientUserId: incident.reporterId });
    }
    if (sender.typ === "user" && incident.assignedAgencyId) {
      const admins = await this.prisma.adminUser.findMany({
        where: { agencyId: incident.assignedAgencyId, isActive: true },
        select: { id: true },
        take: 20,
      });
      for (const admin of admins) {
        if (!(sender.typ === "admin" && sender.sub === admin.id)) {
          recipients.push({ recipientAdminId: admin.id });
        }
      }
    }
    if (sender.typ !== "admin") {
      const dispatchers = await this.prisma.adminUser.findMany({
        where: {
          isActive: true,
          role: { name: { in: ["Call Center Agent", "LGA Admin", "Super Admin"] as never[] } },
        },
        select: { id: true },
        take: 10,
      });
      for (const admin of dispatchers) {
        recipients.push({ recipientAdminId: admin.id });
      }
    }
    if (recipients.length) {
      await this.prisma.incidentMessageReceipt.createMany({
        data: recipients.map((r) => ({
          messageId,
          ...r,
          deliveredAt: now,
          deliveryChannel: "in_app",
        })),
        skipDuplicates: true,
      });
    }
  }

  private async notifyRecipients(
    incidentId: string,
    messageId: string,
    ctx: IncidentCommunicationAccess,
    _messageType: string,
  ) {
    if (!this.notifications) return;
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: { reporterId: true, status: true },
    });
    if (!incident) return;

    if (ctx.role !== "Reporter" && incident.reporterId) {
      const metadata = buildIncidentMessageNotificationMetadata({
        incidentId,
        status: incident.status,
        messageId,
        notificationType: "IncidentMessageReceived",
      });
      await this.notifications.create(
        {
          type: "IncidentMessageReceived",
          title: "New message on your emergency",
          body: "Open your active emergency to read the official update.",
          incidentId,
          userId: incident.reporterId,
          priority: "high",
          metadata,
        },
        undefined,
      );
    }
  }

  private async notifyInformationRequest(incidentId: string, requestId: string, status: string) {
    if (!this.notifications) return;
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: { reporterId: true },
    });
    if (!incident?.reporterId) return;
    await this.notifications.create({
      type: "IncidentInformationRequest",
      title: "Information requested",
      body: "Dispatch needs additional details about your emergency.",
      incidentId,
      userId: incident.reporterId,
      priority: "high",
      metadata: buildIncidentInformationRequestNotificationMetadata({
        incidentId,
        status,
        requestId,
        notificationType: "IncidentInformationRequest",
      }),
    });
  }

  private async tryResolveInformationRequest(
    incidentId: string,
    action: Record<string, unknown>,
    messageId: string,
  ) {
    const requestId =
      typeof action.requestId === "string"
        ? action.requestId
        : typeof action.informationRequestId === "string"
          ? action.informationRequestId
          : null;
    if (!requestId) return;
    await this.prisma.incidentInformationRequest.updateMany({
      where: { id: requestId, incidentId, status: "Open" },
      data: { status: "Responded", responseMessageId: messageId },
    });
  }

  private mapConversation(row: {
    id: string;
    incidentId: string;
    status: string;
    version: number;
    lastMessageAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      incidentId: row.incidentId,
      status: row.status,
      version: row.version,
      lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
      closedAt: row.closedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapMessage(
    row: {
      id: string;
      messageType: string;
      body: string;
      senderRole: string;
      attachmentId: string | null;
      structuredAction: unknown;
      replyToMessageId: string | null;
      clientMessageId: string | null;
      moderationStatus: string;
      metadata: unknown;
      createdAt: Date;
      editedAt: Date | null;
      receipts?: Array<{ deliveredAt: Date | null; readAt: Date | null }>;
    },
    ctx: IncidentCommunicationAccess,
  ) {
    return {
      id: row.id,
      messageType: row.messageType,
      body: row.body,
      senderRole: row.senderRole,
      senderLabel: this.senderLabel(row.senderRole, ctx),
      attachmentId: row.attachmentId,
      structuredAction: row.structuredAction,
      replyToMessageId: row.replyToMessageId,
      clientMessageId: row.clientMessageId,
      moderationStatus: row.moderationStatus,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
      deliveryState: this.deliveryState(row.receipts ?? []),
    };
  }

  private mapInformationRequest(row: {
    id: string;
    requestType: string;
    prompt: string;
    allowedReplyTypes: unknown;
    required: boolean;
    expiresAt: Date | null;
    status: string;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      requestType: row.requestType,
      prompt: row.prompt,
      allowedReplyTypes: row.allowedReplyTypes,
      required: row.required,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private senderLabel(senderRole: string, ctx: IncidentCommunicationAccess) {
    if (senderRole === "Reporter") return ctx.role === "Reporter" ? "You" : "Reporter";
    if (senderRole === "Dispatcher") return "Dispatcher";
    if (senderRole === "Agency") return "Assigned agency";
    if (senderRole === "Responder") return "Responder";
    if (senderRole === "System") return "System";
    return "Official";
  }

  private safePreview(row: { messageType: string; body: string }) {
    if (row.messageType === "Voice") return "Voice message";
    if (row.messageType === "Image") return "Photo";
    if (row.messageType === "Video") return "Video";
    if (row.messageType === "LocationUpdate") return "Location update";
    if (row.messageType === "InformationRequest") return "Information requested";
    return row.body.length > 80 ? `${row.body.slice(0, 77)}...` : row.body;
  }

  private deliveryState(receipts: Array<{ deliveredAt: Date | null; readAt: Date | null }>) {
    if (!receipts.length) return "Sent";
    if (receipts.some((r) => r.readAt)) return "Read";
    if (receipts.some((r) => r.deliveredAt)) return "Delivered";
    return "Sent";
  }
}
