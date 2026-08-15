import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { AdminRoleName } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import {
  assertSupportAttachmentObjectKey,
  createStorageDownloadUrl,
  createStorageUploadUrl,
  getConfiguredStorageBucket,
  supportAttachmentObjectKey,
  validateEvidenceUpload,
} from "../../common/storage/s3-presign";
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
import { PrismaService } from "../prisma/prisma.service";
import type {
  AdminCreateSupportChatDto,
  AssignSupportChatDto,
  ConfirmSupportAttachmentDto,
  CreateSupportChatDto,
  EscalateSupportChatDto,
  ListSupportChatsQueryDto,
  PresignSupportAttachmentDto,
  SendSupportMessageDto,
  UpdateSupportChatPriorityDto,
  UpdateSupportChatStatusDto,
} from "./dto/support-chats.dto";

const CLOSED_STATUSES = new Set(["Closed", "Resolved", "Spam", "Abusive"]);
const SAFE_DIAGNOSTIC_KEYS = new Set([
  "errorCode",
  "requestId",
  "appVersion",
  "deviceModel",
  "timestamp",
  "screen",
  "categoryHint",
]);

@Injectable()
export class SupportChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  // ── Citizen ────────────────────────────────────────────────────────────────

  async listMine(actor: JwtPayload, query: ListSupportChatsQueryDto & CursorPageQuery) {
    this.assertUser(actor);
    return this.listInternal(actor, query, { userId: actor.sub });
  }

  async createMine(actor: JwtPayload, dto: CreateSupportChatDto) {
    this.assertUser(actor);
    await this.assertLinkedResources(actor.sub, dto);
    const reference = this.buildReference();
    const hasBody = Boolean(dto.body?.trim());
    const hasAttachment = Boolean(dto.attachmentKey);
    if (!dto.subject?.trim()) {
      throw new BadRequestException("Subject is required");
    }
    const user = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: { profile: { select: { firstName: true, lastName: true } }, email: true },
    });
    const displayName = dto.anonymousMode
      ? "Anonymous citizen"
      : [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(" ") || user?.email || "Citizen";

    const conversation = await this.prisma.supportConversation.create({
      data: {
        reference,
        type: "CitizenSupport",
        category: dto.category,
        subject: dto.subject.trim(),
        priority: dto.priority ?? "Normal",
        userId: actor.sub,
        incidentId: dto.incidentId,
        linkedReportId: dto.linkedReportId,
        linkedWithdrawalId: dto.linkedWithdrawalId,
        linkedWatchDeviceId: dto.linkedWatchDeviceId,
        linkedCommunityId: dto.linkedCommunityId,
        anonymousMode: dto.anonymousMode ?? false,
        preferredLanguage: dto.preferredLanguage,
        status: "WaitingForAdmin",
        metadata: this.sanitizeDiagnosticMetadata(dto.diagnosticMetadata) as never,
        participants: {
          create: {
            role: "Citizen",
            userId: actor.sub,
            displayName,
          },
        },
      },
    });

    if (hasBody || hasAttachment) {
      const messageBody = hasBody ? dto.body!.trim() : "[Attachment]";
      const message = await this.createMessage({
        conversationId: conversation.id,
        senderRole: "Citizen",
        userId: actor.sub,
        body: messageBody,
        clientMessageId: dto.clientMessageId,
        messageType: dto.messageType ?? (hasAttachment ? "Voice" : "Text"),
        attachmentKey: dto.attachmentKey,
        visibility: "UserVisible",
      });

      await this.prisma.supportConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: message.createdAt,
          lastUserMessageAt: message.createdAt,
          unreadAdmin: { increment: 1 },
        },
      });
    }

    await this.audit.record({
      actor,
      actorType: "user",
      action: "support_chat.created",
      entityType: "SupportConversation",
      entityId: conversation.id,
      metadata: { reference, category: dto.category },
    });

    return this.getMine(actor, conversation.id);
  }

  async getMine(actor: JwtPayload, id: string) {
    this.assertUser(actor);
    const conversation = await this.requireUserConversation(id, actor.sub);
    return this.mapConversationDetail(conversation, actor, true);
  }

  async sendCitizenMessage(actor: JwtPayload, id: string, dto: SendSupportMessageDto) {
    this.assertUser(actor);
    const conversation = await this.requireUserConversation(id, actor.sub);
    if (CLOSED_STATUSES.has(conversation.status)) {
      throw new BadRequestException("Conversation is closed");
    }
    this.assertMessagePayload(dto);
    if (dto.clientMessageId) {
      const existing = await this.prisma.supportMessage.findFirst({
        where: { conversationId: id, clientMessageId: dto.clientMessageId },
      });
      if (existing) return this.mapMessage(existing, actor, true);
    }
    const message = await this.createMessage({
      conversationId: id,
      senderRole: "Citizen",
      userId: actor.sub,
      body: dto.body?.trim() || "[Attachment]",
      clientMessageId: dto.clientMessageId,
      messageType: dto.messageType ?? (dto.attachmentKey ? "Voice" : "Text"),
      replyToMessageId: dto.replyToMessageId,
      attachmentKey: dto.attachmentKey,
      attachmentMimeType: dto.attachmentMimeType,
      attachmentSizeBytes: dto.attachmentSizeBytes,
      attachmentDurationSeconds: dto.attachmentDurationSeconds,
      visibility: "UserVisible",
    });
    await this.prisma.supportConversation.update({
      where: { id },
      data: {
        lastMessageAt: message.createdAt,
        lastUserMessageAt: message.createdAt,
        unreadAdmin: { increment: 1 },
        status: conversation.status === "WaitingForUser" ? "WaitingForAdmin" : conversation.status,
      },
    });
    await this.audit.record({
      actor,
      actorType: "user",
      action: "support_chat.message_sent",
      entityType: "SupportConversation",
      entityId: id,
      metadata: { messageId: message.id },
    });
    return this.mapMessage(message, actor, true);
  }

  async markRead(actor: JwtPayload, id: string) {
    this.assertUser(actor);
    await this.requireUserConversation(id, actor.sub);
    await this.prisma.supportConversation.update({
      where: { id },
      data: { unreadCitizen: 0 },
    });
    return { ok: true };
  }

  async closeMine(actor: JwtPayload, id: string) {
    this.assertUser(actor);
    await this.requireUserConversation(id, actor.sub);
    const updated = await this.prisma.supportConversation.update({
      where: { id },
      data: { status: "Closed", closedAt: new Date() },
    });
    await this.audit.record({
      actor,
      actorType: "user",
      action: "support_chat.closed",
      entityType: "SupportConversation",
      entityId: id,
      metadata: {},
    });
    return this.mapConversation(updated);
  }

  async reopenMine(actor: JwtPayload, id: string) {
    this.assertUser(actor);
    await this.requireUserConversation(id, actor.sub);
    const updated = await this.prisma.supportConversation.update({
      where: { id },
      data: { status: "Reopened", reopenedAt: new Date(), closedAt: null, closeReason: null },
    });
    await this.audit.record({
      actor,
      actorType: "user",
      action: "support_chat.reopened",
      entityType: "SupportConversation",
      entityId: id,
      metadata: {},
    });
    return this.mapConversation(updated);
  }

  async presignAttachment(actor: JwtPayload, id: string, dto: PresignSupportAttachmentDto) {
    this.assertUser(actor);
    await this.requireUserConversation(id, actor.sub);
    validateEvidenceUpload(dto.contentType, dto.sizeBytes);
    const objectKey = supportAttachmentObjectKey(id, dto.fileName);
    const signed = await createStorageUploadUrl(objectKey, 900, dto.contentType);
    return {
      uploadUrl: signed.url,
      objectKey,
      bucket: signed.bucket,
      expiresInSeconds: signed.expiresInSeconds,
    };
  }

  async confirmAttachment(actor: JwtPayload, id: string, dto: ConfirmSupportAttachmentDto) {
    this.assertUser(actor);
    await this.requireUserConversation(id, actor.sub);
    const bucket = getConfiguredStorageBucket();
    assertSupportAttachmentObjectKey(id, dto.objectKey, bucket, dto.contentType);
    await this.audit.record({
      actor,
      actorType: "user",
      action: "support_chat.attachment_confirmed",
      entityType: "SupportConversation",
      entityId: id,
      metadata: { objectKey: dto.objectKey, contentType: dto.contentType },
    });
    return { objectKey: dto.objectKey, contentType: dto.contentType };
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  async list(actor: JwtPayload, query: ListSupportChatsQueryDto & CursorPageQuery) {
    this.assertAdminRead(actor);
    return this.listInternal(actor, query, this.scopeWhere(actor));
  }

  async getById(actor: JwtPayload, id: string) {
    this.assertAdminRead(actor);
    const conversation = await this.prisma.supportConversation.findFirst({
      where: { id, ...this.scopeWhere(actor) } as never,
      include: this.detailInclude(),
    });
    if (!conversation) throw new NotFoundException("Conversation not found");
    return this.mapConversationDetail(conversation, actor, false);
  }

  async create(actor: JwtPayload, dto: AdminCreateSupportChatDto) {
    this.assertAdminWrite(actor);
    const reference = this.buildReference();
    const conversation = await this.prisma.supportConversation.create({
      data: {
        reference,
        type: dto.type,
        category: "Other",
        subject: dto.subject.trim(),
        priority: dto.priority ?? "Normal",
        incidentId: dto.incidentId,
        country: actor.country,
        state: actor.state,
        lga: actor.lga,
        assignedAdminId: actor.sub,
        status: "Assigned",
        participants: {
          create: {
            role: "Admin",
            adminUserId: actor.sub,
            displayName: actor.email ?? "Admin",
          },
        },
      },
      include: { incident: { select: { id: true, title: true } } },
    });
    await this.audit.record({
      actor,
      actorType: "admin",
      action: "support_chat.created",
      entityType: "SupportConversation",
      entityId: conversation.id,
      metadata: { reference, type: dto.type },
    });
    return this.mapConversation(conversation);
  }

  async assign(actor: JwtPayload, id: string, dto: AssignSupportChatDto) {
    this.assertAdminWrite(actor);
    const existing = await this.requireAdminConversation(id, actor);
    const updated = await this.prisma.supportConversation.update({
      where: { id },
      data: {
        assignedAdminId: dto.adminId,
        assignedTeam: dto.team,
        status: "Assigned",
      },
      include: { assignedAdmin: { select: { id: true, displayName: true } } },
    });
    await this.audit.record({
      actor,
      actorType: "admin",
      action: "support_chat.assigned",
      entityType: "SupportConversation",
      entityId: id,
      metadata: { adminId: dto.adminId, team: dto.team },
    });
    await this.notifyUser(existing.userId, id, "SupportChatAssigned", "Your support conversation was assigned.");
    return this.mapConversation(updated);
  }

  async adminReply(actor: JwtPayload, id: string, dto: SendSupportMessageDto) {
    return this.sendAdminMessage(actor, id, dto, false);
  }

  async internalNote(actor: JwtPayload, id: string, dto: SendSupportMessageDto) {
    if (!actor.permissions?.includes("support:internal-note:create")) {
      throw new ForbiddenException("Missing permission: support:internal-note:create");
    }
    return this.sendAdminMessage(actor, id, dto, true);
  }

  async escalate(actor: JwtPayload, id: string, dto: EscalateSupportChatDto) {
    this.assertAdminEscalate(actor);
    const conversation = await this.requireAdminConversation(id, actor);
    const updated = await this.prisma.supportConversation.update({
      where: { id },
      data: {
        status: "Escalated",
        incidentId: dto.incidentId ?? conversation.incidentId,
        priority: "Urgent",
      },
    });
    await this.audit.record({
      actor,
      actorType: "admin",
      action: "support_chat.escalated",
      entityType: "SupportConversation",
      entityId: id,
      metadata: { incidentId: dto.incidentId, reason: dto.reason },
    });
    if (dto.incidentId) {
      await this.audit.record({
        actor,
        actorType: "admin",
        action: "support_chat.incident_linked",
        entityType: "SupportConversation",
        entityId: id,
        metadata: { incidentId: dto.incidentId },
      });
    }
    await this.notifyUser(conversation.userId, id, "SupportChatEscalated", "Your support conversation was escalated for review.");
    return this.mapConversation(updated);
  }

  async resolve(actor: JwtPayload, id: string, dto: UpdateSupportChatStatusDto) {
    return this.updateStatus(actor, id, { ...dto, status: "Resolved" as UpdateSupportChatStatusDto["status"] });
  }

  async close(actor: JwtPayload, id: string, dto: UpdateSupportChatStatusDto) {
    return this.updateStatus(actor, id, { ...dto, status: "Closed" as UpdateSupportChatStatusDto["status"] });
  }

  async reopen(actor: JwtPayload, id: string) {
    this.assertAdminWrite(actor);
    await this.requireAdminConversation(id, actor);
    const updated = await this.prisma.supportConversation.update({
      where: { id },
      data: { status: "Reopened", reopenedAt: new Date(), closedAt: null, closeReason: null },
    });
    await this.audit.record({
      actor,
      actorType: "admin",
      action: "support_chat.reopened",
      entityType: "SupportConversation",
      entityId: id,
      metadata: {},
    });
    await this.notifyUser(updated.userId, id, "SupportChatReopened", "Your support conversation was reopened.");
    return this.mapConversation(updated);
  }

  async markSpam(actor: JwtPayload, id: string, dto: UpdateSupportChatStatusDto) {
    const status = dto.status === "Abusive" ? "Abusive" : "Spam";
    return this.updateStatus(actor, id, { ...dto, status: status as UpdateSupportChatStatusDto["status"] });
  }

  async sendMessage(actor: JwtPayload, id: string, dto: SendSupportMessageDto) {
    return this.adminReply(actor, id, dto);
  }

  async updateStatus(actor: JwtPayload, id: string, dto: UpdateSupportChatStatusDto) {
    this.assertAdminWrite(actor);
    await this.requireAdminConversation(id, actor);
    const updated = await this.prisma.supportConversation.update({
      where: { id },
      data: {
        status: dto.status,
        closedAt: CLOSED_STATUSES.has(dto.status) ? new Date() : null,
        closedById: CLOSED_STATUSES.has(dto.status) ? actor.sub : null,
        closeReason: dto.reason ?? null,
      },
    });
    await this.audit.record({
      actor,
      actorType: "admin",
      action: "support_chat.status_updated",
      entityType: "SupportConversation",
      entityId: id,
      metadata: { status: dto.status, reason: dto.reason },
    });
    if (dto.status === "Resolved") {
      await this.notifyUser(updated.userId, id, "SupportChatResolved", "Your support conversation was marked resolved.");
    }
    return this.mapConversation(updated);
  }

  async updatePriority(actor: JwtPayload, id: string, dto: UpdateSupportChatPriorityDto) {
    this.assertAdminWrite(actor);
    await this.requireAdminConversation(id, actor);
    const updated = await this.prisma.supportConversation.update({
      where: { id },
      data: { priority: dto.priority },
    });
    await this.audit.record({
      actor,
      actorType: "admin",
      action: "support_chat.priority_updated",
      entityType: "SupportConversation",
      entityId: id,
      metadata: { priority: dto.priority },
    });
    return this.mapConversation(updated);
  }

  async presignAdminAttachment(actor: JwtPayload, id: string, dto: PresignSupportAttachmentDto) {
    this.assertAdminWrite(actor);
    await this.requireAdminConversation(id, actor);
    validateEvidenceUpload(dto.contentType, dto.sizeBytes);
    const objectKey = supportAttachmentObjectKey(id, dto.fileName);
    const signed = await createStorageUploadUrl(objectKey, 900, dto.contentType);
    return {
      uploadUrl: signed.url,
      objectKey,
      bucket: signed.bucket,
      expiresInSeconds: signed.expiresInSeconds,
    };
  }

  async getAttachmentUrl(actor: JwtPayload, id: string, messageId: string) {
    const conversation =
      actor.typ === "user"
        ? await this.requireUserConversation(id, actor.sub)
        : await this.requireAdminConversation(id, actor);
    const message = await this.prisma.supportMessage.findFirst({
      where: {
        id: messageId,
        conversationId: conversation.id,
        hasAttachment: true,
        visibility: actor.typ === "user" ? "UserVisible" : undefined,
        deletedAt: null,
      },
    });
    if (!message?.attachmentKey) throw new NotFoundException("Attachment not found");
    await this.audit.record({
      actor,
      actorType: actor.typ === "user" ? "user" : "admin",
      action: "support_chat.attachment_accessed",
      entityType: "SupportMessage",
      entityId: messageId,
      metadata: { conversationId: id },
    });
    const signed = await createStorageDownloadUrl(message.attachmentKey, 300);
    return { url: signed.url, expiresInSeconds: signed.expiresInSeconds };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async listInternal(
    actor: JwtPayload,
    query: ListSupportChatsQueryDto & CursorPageQuery,
    scope: Record<string, unknown>,
  ) {
    const limit = resolvePageLimit(query.limit);
    if (query.cursor?.trim() && !decodeDateIdCursor(query.cursor)) {
      throw new BadRequestException("cursor is invalid");
    }
    const cursor = decodeDateIdCursor(query.cursor);
    const where: Record<string, unknown> = {
      ...scope,
      ...dateIdCursorWhere(cursor),
    };
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.category) where.category = query.category;
    if (query.type) where.type = query.type;
    if (query.incidentId) where.incidentId = query.incidentId;
    if (query.assignedAdminId) where.assignedAdminId = query.assignedAdminId;
    if (query.q?.trim()) {
      where.OR = [
        { subject: { contains: query.q.trim(), mode: "insensitive" } },
        { reference: { contains: query.q.trim(), mode: "insensitive" } },
      ];
    }

    const rows = await this.prisma.supportConversation.findMany({
      where: where as never,
      include: {
        incident: { select: { id: true, title: true, status: true, priority: true } },
        assignedAdmin: { select: { id: true, displayName: true } },
        participants: { where: { leftAt: null }, take: 5 },
        messages: {
          where: { visibility: "UserVisible", deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const page = buildCursorPage(
      rows as Array<{ id: string; createdAt: Date }>,
      limit,
      (item) => encodeDateIdCursor(item.createdAt, item.id),
    );
    return {
      ...page,
      data: page.data.map((row) => this.mapConversation(row as Record<string, unknown>, actor.typ === "user")),
    };
  }

  private async sendAdminMessage(actor: JwtPayload, id: string, dto: SendSupportMessageDto, internal: boolean) {
    this.assertAdminWrite(actor);
    const conversation = await this.requireAdminConversation(id, actor);
    if (CLOSED_STATUSES.has(conversation.status)) throw new BadRequestException("Conversation is closed");
    if (!internal) this.assertMessagePayload(dto);
    if (!dto.body?.trim() && internal) throw new BadRequestException("Internal note body is required");
    if (dto.clientMessageId) {
      const existing = await this.prisma.supportMessage.findFirst({
        where: { conversationId: id, clientMessageId: dto.clientMessageId },
      });
      if (existing) return this.mapMessage(existing, actor, false);
    }
    const message = await this.createMessage({
      conversationId: id,
      senderRole: "Admin",
      adminUserId: actor.sub,
      body: dto.body!.trim(),
      clientMessageId: dto.clientMessageId,
      messageType: dto.messageType ?? "Text",
      replyToMessageId: dto.replyToMessageId,
      attachmentKey: dto.attachmentKey,
      attachmentMimeType: dto.attachmentMimeType,
      attachmentSizeBytes: dto.attachmentSizeBytes,
      attachmentDurationSeconds: dto.attachmentDurationSeconds,
      visibility: internal ? "AdminInternal" : "UserVisible",
      isInternal: internal,
    });
    await this.prisma.supportConversation.update({
      where: { id },
      data: {
        lastMessageAt: message.createdAt,
        lastAdminMessageAt: message.createdAt,
        unreadCitizen: internal ? undefined : { increment: 1 },
        unreadAdmin: internal ? { increment: 0 } : undefined,
        status: internal ? undefined : "WaitingForUser",
      },
    });
    await this.audit.record({
      actor,
      actorType: "admin",
      action: internal ? "support_chat.internal_note" : "support_chat.message_sent",
      entityType: "SupportConversation",
      entityId: id,
      metadata: { messageId: message.id },
    });
    if (!internal && conversation.userId) {
      await this.notifyUser(
        conversation.userId,
        id,
        "SupportChatReply",
        "THE EYE Support replied to your conversation.",
      );
    }
    return this.mapMessage(message, actor, false);
  }

  private async createMessage(input: {
    conversationId: string;
    senderRole: "Citizen" | "Admin" | "System";
    userId?: string;
    adminUserId?: string;
    body: string;
    clientMessageId?: string;
    messageType: string;
    replyToMessageId?: string;
    attachmentKey?: string;
    attachmentMimeType?: string;
    attachmentSizeBytes?: number;
    attachmentDurationSeconds?: number;
    visibility: "UserVisible" | "AdminInternal";
    isInternal?: boolean;
  }) {
    return this.prisma.supportMessage.create({
      data: {
        conversationId: input.conversationId,
        senderRole: input.senderRole,
        userId: input.userId,
        adminUserId: input.adminUserId,
        body: input.body,
        clientMessageId: input.clientMessageId,
        messageType: input.messageType as never,
        replyToMessageId: input.replyToMessageId,
        visibility: input.visibility,
        isInternal: input.isInternal ?? input.visibility === "AdminInternal",
        hasAttachment: Boolean(input.attachmentKey),
        attachmentKey: input.attachmentKey,
        attachmentMimeType: input.attachmentMimeType,
        attachmentSizeBytes: input.attachmentSizeBytes,
        attachmentDurationSeconds: input.attachmentDurationSeconds,
        deliveryStatus: "Sent",
      },
    });
  }

  private detailInclude() {
    return {
      incident: { select: { id: true, title: true, status: true, priority: true, isAnonymous: true } },
      assignedAdmin: { select: { id: true, displayName: true, email: true } },
      participants: { where: { leftAt: null } },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" as const },
        include: {
          adminUser: { select: { id: true, displayName: true } },
          user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
        },
      },
    };
  }

  private async requireUserConversation(id: string, userId: string) {
    const conversation = await this.prisma.supportConversation.findFirst({
      where: { id, userId },
      include: this.detailInclude(),
    });
    if (!conversation) throw new NotFoundException("Conversation not found");
    return conversation;
  }

  private async requireAdminConversation(id: string, actor: JwtPayload) {
    const conversation = await this.prisma.supportConversation.findFirst({
      where: { id, ...this.scopeWhere(actor) } as never,
    });
    if (!conversation) throw new NotFoundException("Conversation not found");
    return conversation;
  }

  private async assertLinkedResources(userId: string, dto: CreateSupportChatDto) {
    if (dto.incidentId) {
      const incident = await this.prisma.incident.findFirst({ where: { id: dto.incidentId, reporterId: userId } });
      if (!incident) throw new ForbiddenException("Incident not accessible");
    }
    if (dto.linkedWatchDeviceId) {
      const device = await this.prisma.smartwatchDevice.findFirst({
        where: { id: dto.linkedWatchDeviceId, userId },
      });
      if (!device) throw new ForbiddenException("Watch device not accessible");
    }
    if (dto.linkedCommunityId) {
      const membership = await this.prisma.communityMembership.findFirst({
        where: { communityId: dto.linkedCommunityId, userId, status: "Approved" },
      });
      if (!membership) throw new ForbiddenException("Community not accessible");
    }
  }

  private assertMessagePayload(dto: SendSupportMessageDto) {
    const hasBody = Boolean(dto.body?.trim());
    const hasAttachment = Boolean(dto.attachmentKey);
    if (!hasBody && !hasAttachment) {
      throw new BadRequestException("Message body or attachment is required");
    }
  }

  private sanitizeDiagnosticMetadata(input?: Record<string, unknown>) {
    if (!input) return {};
    const safe: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (!SAFE_DIAGNOSTIC_KEYS.has(key)) continue;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        safe[key] = value;
      }
    }
    return safe;
  }

  private buildReference() {
    return `SC-${Date.now().toString(36).toUpperCase()}`;
  }

  private async notifyUser(userId: string | null | undefined, conversationId: string, type: string, body: string) {
    if (!userId || !this.notifications) return;
    try {
      await this.notifications.enqueue({
        userId,
        type: type,
        title: "THE EYE Support",
        body,
        channel: "push",
        metadata: { route: `/support/conversation`, conversationId },
      } as never);
    } catch {
      // Non-blocking when queue unavailable in dev.
    }
  }

  private assertUser(actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen authentication required");
  }

  private assertAdminRead(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin authentication required");
    if (!actor.permissions?.some((p) => p === "support:chat:read" || p === "incident:read")) {
      throw new ForbiddenException("Missing permission: support:chat:read");
    }
  }

  private assertAdminWrite(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin authentication required");
    if (!actor.permissions?.some((p) => p === "support:chat:reply" || p === "incident:update")) {
      throw new ForbiddenException("Missing permission: support:chat:reply");
    }
  }

  private assertAdminEscalate(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin authentication required");
    if (!actor.permissions?.some((p) => p === "support:chat:escalate" || p === "incident:escalate")) {
      throw new ForbiddenException("Missing permission: support:chat:escalate");
    }
  }

  private scopeWhere(actor: JwtPayload) {
    if (actor.role === AdminRoleName.SuperAdmin) return {};
    if (actor.role === AdminRoleName.CountryAdmin) return { country: actor.country };
    if (actor.role === AdminRoleName.StateAdmin) return { country: actor.country, state: actor.state };
    if (
      actor.role === AdminRoleName.LgaAdmin ||
      actor.role === AdminRoleName.CallCenterAgent ||
      actor.role === AdminRoleName.OversightAuditor
    ) {
      return { country: actor.country, state: actor.state, lga: actor.lga };
    }
    return { id: "__deny_all__" };
  }

  private mapConversation(row: Record<string, unknown>, citizenView = false) {
    const incident = row.incident as Record<string, unknown> | null | undefined;
    const assignedAdmin = row.assignedAdmin as Record<string, unknown> | null | undefined;
    const messages = Array.isArray(row.messages) ? row.messages : [];
    const lastMessage = messages[0] as Record<string, unknown> | undefined;
    return {
      id: String(row.id),
      reference: String(row.reference),
      type: String(row.type),
      category: String(row.category ?? "Other"),
      status: String(row.status),
      priority: String(row.priority),
      subject: String(row.subject),
      incidentId: row.incidentId ? String(row.incidentId) : null,
      incidentTitle: incident?.title ? String(incident.title) : null,
      assignedAdminId: row.assignedAdminId ? String(row.assignedAdminId) : null,
      assignedAdminName: assignedAdmin?.displayName ? String(assignedAdmin.displayName) : null,
      unreadCount: citizenView ? Number(row.unreadCitizen ?? 0) : Number(row.unreadAdmin ?? 0),
      unreadAdmin: Number(row.unreadAdmin ?? 0),
      unreadCitizen: Number(row.unreadCitizen ?? 0),
      lastMessagePreview: lastMessage?.body ? String(lastMessage.body).slice(0, 120) : null,
      hasAttachment: messages.some((message) => Boolean((message as Record<string, unknown>).hasAttachment)),
      lastMessageAt: row.lastMessageAt ? new Date(String(row.lastMessageAt)).toISOString() : null,
      createdAt: new Date(String(row.createdAt)).toISOString(),
      anonymousMode: Boolean(row.anonymousMode),
      preferredLanguage: row.preferredLanguage ? String(row.preferredLanguage) : null,
    };
  }

  private mapConversationDetail(row: Record<string, unknown>, actor: JwtPayload, citizenView: boolean) {
    const base = this.mapConversation(row, citizenView);
    const incident = row.incident as Record<string, unknown> | null | undefined;
    const participants = Array.isArray(row.participants)
      ? row.participants.map((participant) => {
          const entry = participant as Record<string, unknown>;
          return {
            id: String(entry.id),
            role: String(entry.role),
            displayName: String(entry.displayName),
          };
        })
      : [];
    const canSeeInternal =
      !citizenView &&
      (actor.permissions?.includes("support:internal-note:create") || actor.permissions?.includes("incident:update"));
    const messages = Array.isArray(row.messages)
      ? row.messages
          .filter((message) => {
            const entry = message as Record<string, unknown>;
            if (citizenView) return entry.visibility === "UserVisible";
            return canSeeInternal || entry.visibility === "UserVisible";
          })
          .map((message) => this.mapMessage(message as Record<string, unknown>, actor, citizenView))
      : [];

    return {
      ...base,
      linkedReportId: row.linkedReportId ? String(row.linkedReportId) : null,
      linkedWithdrawalId: row.linkedWithdrawalId ? String(row.linkedWithdrawalId) : null,
      linkedWatchDeviceId: row.linkedWatchDeviceId ? String(row.linkedWatchDeviceId) : null,
      linkedCommunityId: row.linkedCommunityId ? String(row.linkedCommunityId) : null,
      incident: incident
        ? {
            id: String(incident.id),
            title: String(incident.title),
            status: String(incident.status),
            priority: String(incident.priority),
            isAnonymous: Boolean(incident.isAnonymous),
          }
        : null,
      participants,
      messages,
      transport: { mode: "poll", intervalSeconds: 5 },
    };
  }

  private mapMessage(entry: Record<string, unknown>, actor: JwtPayload, citizenView: boolean) {
    const adminUser = entry.adminUser as Record<string, unknown> | null | undefined;
    const user = entry.user as Record<string, unknown> | null | undefined;
    const profile = user?.profile as Record<string, unknown> | null | undefined;
    const senderName = adminUser?.displayName
      ? String(adminUser.displayName)
      : citizenView
        ? entry.senderRole === "Admin"
          ? "THE EYE Support"
          : "You"
        : [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Citizen";
    return {
      id: String(entry.id),
      body: String(entry.body),
      messageType: String(entry.messageType ?? "Text"),
      visibility: String(entry.visibility ?? "UserVisible"),
      isInternal: Boolean(entry.isInternal),
      hasAttachment: Boolean(entry.hasAttachment),
      attachmentMimeType: entry.attachmentMimeType ? String(entry.attachmentMimeType) : null,
      attachmentDurationSeconds: entry.attachmentDurationSeconds ?? null,
      senderRole: String(entry.senderRole),
      senderName,
      clientMessageId: entry.clientMessageId ? String(entry.clientMessageId) : null,
      replyToMessageId: entry.replyToMessageId ? String(entry.replyToMessageId) : null,
      deliveryStatus: String(entry.deliveryStatus ?? "Sent"),
      createdAt: new Date(String(entry.createdAt)).toISOString(),
    };
  }
}
