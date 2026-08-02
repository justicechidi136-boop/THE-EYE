import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AdminRoleName } from "@the-eye/shared";
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
import { PrismaService } from "../prisma/prisma.service";
import type {
  AssignSupportChatDto,
  CreateSupportChatDto,
  ListSupportChatsQueryDto,
  SendSupportMessageDto,
  UpdateSupportChatPriorityDto,
  UpdateSupportChatStatusDto,
} from "./dto/support-chats.dto";

@Injectable()
export class SupportChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: JwtPayload, query: ListSupportChatsQueryDto & CursorPageQuery) {
    this.assertAdmin(actor);
    const limit = resolvePageLimit(query.limit);
    if (query.cursor?.trim() && !decodeDateIdCursor(query.cursor)) {
      throw new BadRequestException("cursor is invalid");
    }
    const cursor = decodeDateIdCursor(query.cursor);
    const where: Record<string, unknown> = {
      ...this.scopeWhere(actor),
      ...dateIdCursorWhere(cursor),
    };
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
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
          where: { isInternal: false },
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
      data: page.data.map((row) => this.mapConversation(row as Record<string, unknown>)),
    };
  }

  async getById(actor: JwtPayload, id: string) {
    this.assertAdmin(actor);
    const conversation = await this.prisma.supportConversation.findFirst({
      where: { id, ...this.scopeWhere(actor) } as never,
      include: {
        incident: { select: { id: true, title: true, status: true, priority: true, isAnonymous: true } },
        assignedAdmin: { select: { id: true, displayName: true, email: true } },
        participants: { where: { leftAt: null } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            adminUser: { select: { id: true, displayName: true } },
            user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });
    if (!conversation) throw new NotFoundException("Conversation not found");
    return this.mapConversationDetail(conversation, actor);
  }

  async create(actor: JwtPayload, dto: CreateSupportChatDto) {
    this.assertAdmin(actor);
    const reference = `SC-${Date.now().toString(36).toUpperCase()}`;
    const conversation = await this.prisma.supportConversation.create({
      data: {
        reference,
        type: dto.type,
        subject: dto.subject.trim(),
        priority: dto.priority ?? "Normal",
        incidentId: dto.incidentId,
        country: actor.country,
        state: actor.state,
        lga: actor.lga,
        assignedAdminId: actor.sub,
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
    this.assertAdmin(actor);
    const existing = await this.requireConversation(id, actor);
    const updated = await this.prisma.supportConversation.update({
      where: { id: existing.id },
      data: { assignedAdminId: dto.adminId, status: "Open" },
      include: { assignedAdmin: { select: { id: true, displayName: true } } },
    });
    await this.audit.record({
      actor,
      actorType: "admin",
      action: "support_chat.assigned",
      entityType: "SupportConversation",
      entityId: id,
      metadata: { adminId: dto.adminId },
    });
    return this.mapConversation(updated);
  }

  async sendMessage(actor: JwtPayload, id: string, dto: SendSupportMessageDto) {
    this.assertAdmin(actor);
    const conversation = await this.requireConversation(id, actor);
    if (conversation.status === "Closed") throw new BadRequestException("Conversation is closed");
    const message = await this.prisma.supportMessage.create({
      data: {
        conversationId: id,
        senderRole: "Admin",
        adminUserId: actor.sub,
        body: dto.body.trim(),
        isInternal: dto.isInternal ?? false,
      },
    });
    await this.prisma.supportConversation.update({
      where: { id },
      data: { lastMessageAt: message.createdAt, unreadCitizen: { increment: dto.isInternal ? 0 : 1 } },
    });
    await this.audit.record({
      actor,
      actorType: "admin",
      action: dto.isInternal ? "support_chat.internal_note" : "support_chat.message_sent",
      entityType: "SupportConversation",
      entityId: id,
      metadata: { messageId: message.id },
    });
    return {
      id: message.id,
      body: message.body,
      isInternal: message.isInternal,
      createdAt: message.createdAt.toISOString(),
      senderRole: message.senderRole,
    };
  }

  async updateStatus(actor: JwtPayload, id: string, dto: UpdateSupportChatStatusDto) {
    this.assertAdmin(actor);
    await this.requireConversation(id, actor);
    const updated = await this.prisma.supportConversation.update({
      where: { id },
      data: {
        status: dto.status,
        closedAt: dto.status === "Closed" ? new Date() : null,
        closedById: dto.status === "Closed" ? actor.sub : null,
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
    return this.mapConversation(updated);
  }

  async updatePriority(actor: JwtPayload, id: string, dto: UpdateSupportChatPriorityDto) {
    this.assertAdmin(actor);
    await this.requireConversation(id, actor);
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

  private async requireConversation(id: string, actor: JwtPayload) {
    const conversation = await this.prisma.supportConversation.findFirst({
      where: { id, ...this.scopeWhere(actor) } as never,
    });
    if (!conversation) throw new NotFoundException("Conversation not found");
    return conversation;
  }

  private assertAdmin(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin authentication required");
    if (!actor.permissions?.includes("incident:read")) {
      throw new ForbiddenException("Missing permission: incident:read");
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

  private mapConversation(row: Record<string, unknown>) {
    const incident = row.incident as Record<string, unknown> | null | undefined;
    const assignedAdmin = row.assignedAdmin as Record<string, unknown> | null | undefined;
    const messages = Array.isArray(row.messages) ? row.messages : [];
    const lastMessage = messages[0] as Record<string, unknown> | undefined;
    return {
      id: String(row.id),
      reference: String(row.reference),
      type: String(row.type),
      status: String(row.status),
      priority: String(row.priority),
      subject: String(row.subject),
      incidentId: row.incidentId ? String(row.incidentId) : null,
      incidentTitle: incident?.title ? String(incident.title) : null,
      assignedAdminId: row.assignedAdminId ? String(row.assignedAdminId) : null,
      assignedAdminName: assignedAdmin?.displayName ? String(assignedAdmin.displayName) : null,
      unreadAdmin: Number(row.unreadAdmin ?? 0),
      lastMessagePreview: lastMessage?.body ? String(lastMessage.body).slice(0, 120) : null,
      hasAttachment: messages.some((message) => Boolean((message as Record<string, unknown>).hasAttachment)),
      lastMessageAt: row.lastMessageAt ? new Date(String(row.lastMessageAt)).toISOString() : null,
      createdAt: new Date(String(row.createdAt)).toISOString(),
    };
  }

  private mapConversationDetail(row: Record<string, unknown>, actor: JwtPayload) {
    const base = this.mapConversation(row);
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
    const messages = Array.isArray(row.messages)
      ? row.messages
          .filter((message) => {
            const entry = message as Record<string, unknown>;
            return actor.permissions?.includes("incident:update") || !entry.isInternal;
          })
          .map((message) => {
            const entry = message as Record<string, unknown>;
            const adminUser = entry.adminUser as Record<string, unknown> | null | undefined;
            return {
              id: String(entry.id),
              body: String(entry.body),
              isInternal: Boolean(entry.isInternal),
              hasAttachment: Boolean(entry.hasAttachment),
              senderRole: String(entry.senderRole),
              senderName: adminUser?.displayName ? String(adminUser.displayName) : "Participant",
              createdAt: new Date(String(entry.createdAt)).toISOString(),
            };
          })
      : [];

    return {
      ...base,
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
    };
  }
}
