import { Injectable } from "@nestjs/common";
import { BroadcastStatus, BroadcastType } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { BROADCAST_SYSTEM_ACTOR } from "./broadcasts.service";
import { buildBroadcastNotificationMetadata } from "../notifications/notification-routing.schema";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { BroadcastQueueService } from "./broadcast-queue.service";

export type BroadcastLifecycleEvent =
  | "MISSING_PERSON_FOUND"
  | "STOLEN_VEHICLE_RECOVERED"
  | "BROADCAST_WITHDRAWN"
  | "BROADCAST_SUSPENDED"
  | "BROADCAST_RESTORED"
  | "BROADCAST_OFFICIAL_UPDATE"
  | "BROADCAST_EXPIRY_REVIEW";

@Injectable()
export class BroadcastLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly audit: AuditService,
    private readonly broadcastQueue: BroadcastQueueService,
  ) {}

  async enqueueResolutionNotifications(
    broadcastId: string,
    eventType: BroadcastLifecycleEvent,
    actor: JwtPayload = BROADCAST_SYSTEM_ACTOR,
  ) {
    const broadcast = await this.prisma.broadcast.findUnique({ where: { id: broadcastId } });
    if (!broadcast) return { queued: false };
    await this.broadcastQueue.enqueueResolutionDelivery(broadcastId, eventType, 0);
    await this.audit.record({
      actor,
      action: "broadcast.lifecycle_notification_queued",
      entityType: "broadcasts",
      entityId: broadcastId,
      metadata: { eventType, status: broadcast.status },
    });
    return { queued: true, eventType };
  }

  async executeResolutionDeliveryBatch(
    broadcastId: string,
    eventType: BroadcastLifecycleEvent,
    batchNumber: number,
    batchSize = 100,
  ) {
    const broadcast = await this.prisma.broadcast.findUnique({ where: { id: broadcastId } });
    if (!broadcast) return { delivered: 0, completed: true };

    const recipients = await this.prisma.broadcastDelivery.findMany({
      where: { broadcastId },
      select: { userId: true },
      orderBy: { createdAt: "asc" },
      skip: batchNumber * batchSize,
      take: batchSize,
    });
    if (!recipients.length) return { delivered: 0, completed: true };

    const title = this.lifecycleTitle(broadcast.type as BroadcastType, eventType);
    const body = this.lifecycleBody(broadcast.title, eventType);
    const metadata = buildBroadcastNotificationMetadata({
      broadcastId,
      broadcastCategory: String(broadcast.type),
      countryCode: String(broadcast.country ?? ""),
      issuedAt: new Date().toISOString(),
      eventType,
      status: String(broadcast.status),
    });

    for (const recipient of recipients) {
      const notification = await this.prisma.notification.create({
        data: {
          userId: recipient.userId,
          broadcastId,
          type: "BroadcastAlert",
          priority: "Normal" as never,
          channel: "push",
          title,
          body,
          status: "Pending" as never,
          provider: "firebase-cloud-messaging",
          metadata,
        } as never,
      });
      await this.notificationsService.enqueue({
        userId: recipient.userId,
        notificationId: notification.id,
        title,
        body,
        broadcastId,
        channel: "push",
        type: "BroadcastAlert",
        priority: "Normal",
        provider: "firebase-cloud-messaging",
      });
    }

    return { delivered: recipients.length, completed: recipients.length < batchSize };
  }

  async claimExpiryCandidates(limit = 25) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM broadcasts
        WHERE status IN ('Active', 'Updated')
          AND deleted_at IS NULL
          AND expires_at IS NOT NULL
          AND expires_at <= NOW() + INTERVAL '3 days'
          AND expires_at > NOW()
          AND (metadata->>'expiryReminderSentAt') IS NULL
        ORDER BY expires_at ASC
        LIMIT $1`,
      limit,
    );
    return rows.map((row) => row.id);
  }

  async sendExpiryReminder(broadcastId: string, actor: JwtPayload = BROADCAST_SYSTEM_ACTOR) {
    const broadcast = await this.prisma.broadcast.findUnique({ where: { id: broadcastId } });
    if (!broadcast?.creatorUserId) return { skipped: true };
    const title = "Broadcast expiry review";
    const body =
      broadcast.type === BroadcastType.MissingPerson
        ? "Is this missing-person broadcast still active?"
        : "Is this stolen-vehicle broadcast still active?";
    const metadata = buildBroadcastNotificationMetadata({
      broadcastId,
      broadcastCategory: String(broadcast.type),
      countryCode: String(broadcast.country ?? ""),
      issuedAt: new Date().toISOString(),
      eventType: "BROADCAST_EXPIRY_REVIEW",
      status: String(broadcast.status),
    });
    const notification = await this.prisma.notification.create({
      data: {
        userId: broadcast.creatorUserId,
        broadcastId,
        type: "BroadcastAlert",
        priority: "Normal" as never,
        channel: "push",
        title,
        body,
        status: "Pending" as never,
        provider: "firebase-cloud-messaging",
        metadata,
      } as never,
    });
    await this.notificationsService.enqueue({
      userId: broadcast.creatorUserId,
      notificationId: notification.id,
      title,
      body,
      broadcastId,
      channel: "push",
      type: "BroadcastAlert",
      priority: "Normal",
      provider: "firebase-cloud-messaging",
    });
    const priorMetadata =
      typeof broadcast.metadata === "object" && broadcast.metadata ? (broadcast.metadata as Record<string, unknown>) : {};
    await this.prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        metadata: { ...priorMetadata, expiryReminderSentAt: new Date().toISOString() },
      } as never,
    });
    await this.audit.record({
      actor,
      action: "broadcast.expiry_reminder_sent",
      entityType: "broadcasts",
      entityId: broadcastId,
      metadata: { expiresAt: broadcast.expiresAt?.toISOString() ?? null },
    });
    return { sent: true };
  }

  async expireBroadcast(broadcastId: string, actor: JwtPayload = BROADCAST_SYSTEM_ACTOR) {
    const prior = await this.prisma.broadcast.findUnique({ where: { id: broadcastId } });
    const broadcast = await this.prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: BroadcastStatus.Expired as never },
    });
    await this.audit.record({
      actor,
      action: "broadcast.expired",
      entityType: "broadcasts",
      entityId: broadcastId,
      metadata: { priorStatus: prior?.status ?? null },
    });
    return broadcast;
  }

  private lifecycleTitle(type: BroadcastType, eventType: BroadcastLifecycleEvent) {
    if (eventType === "MISSING_PERSON_FOUND") return "Missing person update";
    if (eventType === "STOLEN_VEHICLE_RECOVERED") return "Stolen vehicle update";
    if (eventType === "BROADCAST_WITHDRAWN") return "Broadcast withdrawn";
    if (eventType === "BROADCAST_SUSPENDED") return "Broadcast suspended";
    if (eventType === "BROADCAST_RESTORED") return "Broadcast restored";
    return "Broadcast update";
  }

  private lifecycleBody(title: string, eventType: BroadcastLifecycleEvent) {
    if (eventType === "MISSING_PERSON_FOUND") return `${title} has been marked found.`;
    if (eventType === "STOLEN_VEHICLE_RECOVERED") return `${title} has been marked recovered.`;
    if (eventType === "BROADCAST_WITHDRAWN") return `${title} was withdrawn by the author.`;
    if (eventType === "BROADCAST_SUSPENDED") return `${title} was suspended for review.`;
    if (eventType === "BROADCAST_RESTORED") return `${title} was restored by an administrator.`;
    return `${title} was updated.`;
  }
}
