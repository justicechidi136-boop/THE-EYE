import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BroadcastAuthorType, BroadcastStatus, BroadcastType, IncidentPriority, IncidentStatus } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { MetricsService } from "../../common/metrics/metrics.service";
import {
  buildCursorPage,
  dateIdCursorWhere,
  decodeDateIdCursor,
  encodeDateIdCursor,
  resolvePageLimit,
  type CursorPageQuery,
} from "../../common/pagination/cursor-pagination";
import {
  createStorageDownloadUrl,
  validateEvidenceUpload,
} from "../../common/storage/s3-presign";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { approvalRequiredTypes, CreateBroadcastDto, validateCreateBroadcastDto } from "./dto/broadcast.dto";
import { buildBroadcastNotificationMetadata } from "../notifications/notification-routing.schema";
import type { BroadcastCountryDeliveryJobPayload } from "../../common/queue/queue-jobs";

import { BroadcastSchedulerDiagnosticsService } from "./broadcast-scheduler-diagnostics.service";

export const BROADCAST_SYSTEM_ACTOR: JwtPayload = {
  typ: "admin",
  sub: "system",
  permissions: ["broadcast:publish", "broadcast:approve"],
  role: "Super Admin",
};

const AUTO_BROADCAST_CONFIDENCE = 85;
const DISPATCH_BATCH_SIZE = 25;
const COUNTRY_DELIVERY_BATCH_SIZE = 100;
export const LIVE_BROADCAST_STATUSES = new Set<string>([
  BroadcastStatus.Published,
  BroadcastStatus.Active,
  BroadcastStatus.Updated,
]);
const LIVE_BROADCAST_STATUS_SQL = `'Published', 'Active', 'Updated'`;
const PRIORITY_ORDER_SQL = `
  CASE b.priority
    WHEN 'P1LifeThreatening' THEN 1
    WHEN 'P2ActiveCrimeAccident' THEN 2
    WHEN 'P3SuspiciousActivity' THEN 3
    ELSE 4
  END ASC,
  b.published_at DESC NULLS LAST,
  b.id DESC`;
const BROADCAST_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isBroadcastId(value: string): boolean {
  return BROADCAST_ID_RE.test(value.trim());
}

@Injectable()
export class BroadcastsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly metrics: MetricsService,
    private readonly schedulerDiagnostics: BroadcastSchedulerDiagnosticsService,
  ) {}

  async list(actor: JwtPayload, query: CursorPageQuery = {}) {
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const rows = await this.prisma.broadcast.findMany({
      where: { ...this.scopeWhere(actor), ...dateIdCursorWhere(cursor) },
      include: { notifications: true, deliveries: true, incident: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    return buildCursorPage(rows, limit, (item) => encodeDateIdCursor(item.createdAt, item.id));
  }

  async create(dto: CreateBroadcastDto, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can create broadcasts");
    validateCreateBroadcastDto(dto);

    const requiresApproval = dto.requiresApproval ?? this.requiresApproval(dto.type, dto.priority);
    const saveAsDraft = dto.saveAsDraft === true;
    const scheduledAt = dto.scheduledAt ? this.parseUtcTimestamp(dto.scheduledAt, "scheduledAt") : undefined;
    const futureScheduled = scheduledAt ? scheduledAt.getTime() > Date.now() : false;
    const status = saveAsDraft
      ? BroadcastStatus.Draft
      : futureScheduled
        ? BroadcastStatus.Scheduled
        : requiresApproval
          ? BroadcastStatus.PendingApproval
          : BroadcastStatus.Published;
    const jurisdictionId = dto.jurisdictionId ?? (await this.inferJurisdictionId(dto));

    const broadcast = await this.prisma.broadcast.create({
      data: {
        jurisdictionId,
        incidentId: dto.incidentId,
        creatorAdminId: actor.sub,
        type: dto.type as never,
        title: dto.title.trim(),
        body: dto.body.trim(),
        priority: dto.priority as never,
        status: status as never,
        requiresApproval,
        autoPublished: false,
        targetRadiusMeters: dto.radiusMeters,
        publishedAt: status === BroadcastStatus.Published ? new Date() : undefined,
        scheduledAt,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      } as never,
    });

    await this.writeGeofence(broadcast.id, { ...dto, jurisdictionId });
    await this.audit(actor, "broadcast.created", broadcast.id, { status, type: dto.type, requiresApproval, scheduledAt: scheduledAt?.toISOString() ?? null });

    if (status === BroadcastStatus.Published) {
      await this.dispatch(broadcast.id, actor, "broadcast.published");
    }

    return { data: await this.getById(broadcast.id) };
  }

  async createFromField(dto: CreateBroadcastDto, actor: JwtPayload) {
    if (actor.typ !== "field") throw new ForbiddenException("Field session required");
    if (!actor.country) throw new ForbiddenException("Field session country is required");

    const allowedTypes = new Set<BroadcastType>([
      BroadcastType.Emergency,
      BroadcastType.Crime,
      BroadcastType.Accident,
      BroadcastType.CommunityWarning,
    ]);
    if (!allowedTypes.has(dto.type)) {
      throw new BadRequestException("Unsupported field broadcast category");
    }
    validateCreateBroadcastDto(dto);

    const attachments = this.sanitizeFieldAttachments(dto.attachments, actor.sub);

    const jurisdictionId = actor.jurisdictionId ?? dto.jurisdictionId ?? (await this.inferJurisdictionId(dto));
    const broadcast = await this.prisma.broadcast.create({
      data: {
        jurisdictionId,
        incidentId: dto.incidentId,
        creatorAdminId: actor.sub,
        authorType: BroadcastAuthorType.Admin as never,
        type: dto.type as never,
        title: dto.title.trim(),
        body: dto.body.trim(),
        priority: dto.priority as never,
        status: BroadcastStatus.PendingApproval as never,
        requiresApproval: true,
        autoPublished: false,
        country: actor.country,
        state: actor.state,
        lga: actor.lga,
        targetRadiusMeters: dto.radiusMeters,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        metadata: {
          source: "field_tablet",
          fieldRole: actor.fieldRole ?? null,
          fieldDeviceId: actor.fieldDeviceId ?? null,
          attachmentCount: attachments.length,
        },
      } as never,
    });

    await this.writeGeofence(broadcast.id, { ...dto, jurisdictionId });
    await this.persistFieldBroadcastMedia(broadcast.id, actor.sub, attachments);
    await this.audit(actor, "broadcast.field_submitted", broadcast.id, {
      status: BroadcastStatus.PendingApproval,
      type: dto.type,
      country: actor.country,
    });

    return { data: broadcast };
  }

  private sanitizeFieldAttachments(raw: unknown, uploaderAdminId: string) {
    if (!Array.isArray(raw)) return [];
    if (raw.length > 8) throw new BadRequestException("A field broadcast supports up to 8 attachments");
    const expectedPrefix = `evidence/broadcast-field-${uploaderAdminId}/`;
    return raw.map((item, index) => {
      if (!item || typeof item !== "object") throw new BadRequestException("Invalid field broadcast attachment");
      const row = item as Record<string, unknown>;
      const mediaType = String(row.mediaType ?? "").trim().toLowerCase();
      const contentType = String(row.contentType ?? "").trim().toLowerCase();
      const objectKey = String(row.objectKey ?? "").trim();
      const bucket = String(row.bucket ?? "").trim();
      if (!["image", "video", "audio"].includes(mediaType)) {
        throw new BadRequestException("Unsupported field broadcast media type");
      }
      validateEvidenceUpload(contentType, Number(row.sizeBytes));
      if (!objectKey.startsWith(expectedPrefix) || objectKey.includes("..") || !bucket) {
        throw new BadRequestException("Invalid field broadcast evidence object key");
      }
      return {
        mediaType,
        contentType,
        objectKey,
        bucket,
        fileHash: String(row.fileHash ?? "").trim() || null,
        sizeBytes: Number(row.sizeBytes),
        capturedAt: row.capturedAt ? new Date(String(row.capturedAt)) : null,
        durationSeconds: Number.isInteger(Number(row.durationSeconds)) ? Number(row.durationSeconds) : null,
        clientAttachmentId: String(row.clientAttachmentId ?? "").trim() || `field-${index + 1}`,
        selectedLanguage: String(row.selectedLanguage ?? "").trim() || null,
      };
    });
  }

  private async persistFieldBroadcastMedia(
    broadcastId: string,
    uploaderAdminId: string,
    attachments: ReturnType<BroadcastsService["sanitizeFieldAttachments"]>,
  ) {
    for (const attachment of attachments) {
      const mediaType = attachment.mediaType === "image" ? "Image" : attachment.mediaType === "video" ? "Video" : "Audio";
      await this.prisma.broadcastMedia.create({
        data: {
          broadcastId,
          uploaderId: null,
          uploaderAdminId,
          role: "IncidentEvidence",
          mediaType: mediaType as never,
          bucket: attachment.bucket,
          objectKey: attachment.objectKey,
          contentType: attachment.contentType,
          fileHash: attachment.fileHash,
          sizeBytes: BigInt(attachment.sizeBytes),
          capturedAt: attachment.capturedAt,
          durationSeconds: attachment.durationSeconds,
          clientAttachmentId: attachment.clientAttachmentId,
          selectedLanguage: attachment.selectedLanguage,
          transcriptionStatus: attachment.mediaType === "audio" ? "Uploaded" as never : null,
        },
      });
    }
  }

  async getSchedulerHealth(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can view scheduler health");
    return this.schedulerDiagnostics.getHealth();
  }

  async get(id: string, actor: JwtPayload) {
    await this.assertCanAccess(id, actor);
    return { data: await this.getById(id) };
  }

  async approve(id: string, actor: JwtPayload, note?: string) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can approve broadcasts");
    await this.assertCanAccess(id, actor);
    const broadcast = await this.getById(id);
    if (broadcast.status !== BroadcastStatus.PendingApproval && broadcast.status !== BroadcastStatus.Draft) {
      throw new BadRequestException("Only draft or pending broadcasts can be approved");
    }

    const scheduledAt = (broadcast as { scheduledAt?: Date | null }).scheduledAt;
    const futureScheduled = scheduledAt ? scheduledAt.getTime() > Date.now() : false;

    if (futureScheduled) {
      await this.prisma.broadcast.update({
        where: { id },
        data: {
          approverAdminId: actor.sub,
          status: BroadcastStatus.Scheduled as never,
        } as never,
      });
      await this.audit(actor, "broadcast.approved", id, { note, scheduledAt: scheduledAt.toISOString() });
      return { data: await this.getById(id) };
    }

    await this.prisma.broadcast.update({
      where: { id },
      data: {
        approverAdminId: actor.sub,
        status: BroadcastStatus.Published as never,
        publishedAt: new Date(),
      } as never,
    });
    await this.audit(actor, "broadcast.approved", id, { note });
    return this.dispatch(id, actor, "broadcast.approved_and_dispatched");
  }

  async reject(id: string, actor: JwtPayload, reason: string) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can reject broadcasts");
    await this.assertCanAccess(id, actor);
    if (!reason?.trim()) throw new BadRequestException("Rejection reason is required");
    await this.prisma.broadcast.update({
      where: { id },
      data: { status: BroadcastStatus.Rejected as never, approverAdminId: actor.sub, rejectedReason: reason } as never,
    });
    await this.audit(actor, "broadcast.rejected", id, { reason });
    return { data: await this.getById(id) };
  }

  async dispatch(id: string, actor: JwtPayload, action = "broadcast.dispatched") {
    const startedAt = Date.now();
    try {
      await this.assertCanAccess(id, actor);
      const broadcast = await this.getById(id);
      if (!LIVE_BROADCAST_STATUSES.has(String(broadcast.status))) {
        throw new BadRequestException("Broadcast must be live before dispatch");
      }

      const recipients = await this.expandRecipients(id);
      await this.deliverToRecipients(broadcast, id, recipients, actor, action);
      this.metrics.recordBroadcastDispatch((Date.now() - startedAt) / 1000, "success");
      return { data: await this.getById(id), recipientCount: recipients.length };
    } catch (error) {
      this.metrics.recordBroadcastDispatch((Date.now() - startedAt) / 1000, "error");
      throw error;
    }
  }

  async claimDueBroadcasts(limit = 25): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `UPDATE broadcasts b
          SET status = 'DispatchQueued',
              dispatch_queued_at = NOW(),
              dispatch_failure_reason = NULL
        WHERE b.id IN (
          SELECT id
            FROM broadcasts
           WHERE scheduled_at IS NOT NULL
             AND scheduled_at <= NOW()
             AND status IN ('Scheduled', 'Published')
             AND status NOT IN ('Cancelled', 'Rejected', 'Expired', 'DispatchQueued', 'Dispatching', 'Failed')
             AND NOT EXISTS (
               SELECT 1 FROM broadcast_deliveries bd WHERE bd.broadcast_id = broadcasts.id
             )
           FOR UPDATE SKIP LOCKED
           LIMIT $1
        )
        RETURNING b.id`,
      limit,
    );
    return rows.map((row) => row.id);
  }

  async recordDispatchQueued(broadcastId: string, jobId: string | null, duplicate: boolean) {
    await this.audit(BROADCAST_SYSTEM_ACTOR, "broadcast.dispatch_queued", broadcastId, { jobId, duplicate, actorType: "system" });
  }

  async revertDispatchClaim(broadcastId: string, error: unknown) {
    const message = error instanceof Error ? error.message : "queue unavailable";
    await this.prisma.broadcast.updateMany({
      where: { id: broadcastId, status: "DispatchQueued" as never },
      data: {
        status: BroadcastStatus.Scheduled as never,
        dispatchQueuedAt: null,
        dispatchFailureReason: message,
      } as never,
    });
    await this.audit(BROADCAST_SYSTEM_ACTOR, "broadcast.auto_dispatch_failed", broadcastId, {
      stage: "enqueue",
      reason: message,
      actorType: "system",
    });
  }

  async executeAutoDispatch(broadcastId: string) {
    const broadcast = await this.getById(broadcastId);
    if ([BroadcastStatus.Cancelled, BroadcastStatus.Rejected, BroadcastStatus.Expired].includes(broadcast.status as BroadcastStatus)) {
      return { skipped: true, reason: "terminal_status", status: broadcast.status };
    }
    if (broadcast.status === BroadcastStatus.DispatchQueued || broadcast.status === BroadcastStatus.Scheduled) {
      await this.prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
          status: BroadcastStatus.Dispatching as never,
          dispatchStartedAt: new Date(),
        } as never,
      });
    } else if (broadcast.status !== BroadcastStatus.Dispatching) {
      return { skipped: true, reason: "not_claimed", status: broadcast.status };
    }

    await this.audit(BROADCAST_SYSTEM_ACTOR, "broadcast.auto_dispatch_started", broadcastId, { actorType: "system" });

    const refreshed = await this.getById(broadcastId);
    if ([BroadcastStatus.Cancelled, BroadcastStatus.Rejected].includes(refreshed.status as BroadcastStatus)) {
      await this.prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: BroadcastStatus.Scheduled as never, dispatchStartedAt: null, dispatchQueuedAt: null } as never,
      });
      return { skipped: true, reason: "cancelled_before_dispatch" };
    }

    try {
      if (refreshed.status !== BroadcastStatus.Published) {
        await this.prisma.broadcast.update({
          where: { id: broadcastId },
          data: {
            status: BroadcastStatus.Published as never,
            publishedAt: refreshed.publishedAt ?? new Date(),
          } as never,
        });
      }

      const current = await this.getById(broadcastId);
      const recipients = await this.expandRecipients(broadcastId);
      await this.deliverToRecipients(current, broadcastId, recipients, BROADCAST_SYSTEM_ACTOR, "broadcast.auto_dispatched");

      await this.prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
          status: BroadcastStatus.Published as never,
          dispatchCompletedAt: new Date(),
          dispatchFailureReason: null,
        } as never,
      });
      await this.audit(BROADCAST_SYSTEM_ACTOR, "broadcast.auto_dispatch_completed", broadcastId, {
        recipientCount: recipients.length,
        actorType: "system",
      });
      return { data: await this.getById(broadcastId), recipientCount: recipients.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : "auto dispatch failed";
      await this.prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
          status: BroadcastStatus.Failed as never,
          dispatchFailureReason: message,
        } as never,
      });
      await this.audit(BROADCAST_SYSTEM_ACTOR, "broadcast.auto_dispatch_failed", broadcastId, {
        stage: "dispatch",
        reason: message,
        actorType: "system",
      });
      throw error;
    }
  }

  async preview(id: string, actor: JwtPayload) {
    await this.assertCanAccess(id, actor);
    const broadcast = await this.getById(id);
    const estimate = await this.estimateRecipients(id, actor);
    return {
      data: {
        broadcast,
        preview: {
          title: broadcast.title,
          body: broadcast.body,
          priority: broadcast.priority,
          type: broadcast.type,
          status: broadcast.status,
          scheduledAt: (broadcast as { scheduledAt?: Date | null }).scheduledAt ?? null,
          estimatedRecipients: estimate.estimatedRecipients,
          sampleRecipients: estimate.sampleRecipients,
        },
      },
    };
  }

  async estimateRecipients(id: string, actor: JwtPayload) {
    await this.assertCanAccess(id, actor);
    const recipients = await this.expandRecipients(id);
    return {
      broadcastId: id,
      estimatedRecipients: recipients.length,
      sampleRecipients: recipients.slice(0, 10).map((entry) => ({
        userId: entry.user_id,
        distanceMeters: entry.distance_meters,
      })),
    };
  }

  async schedule(id: string, actor: JwtPayload, scheduledAtIso: string) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can schedule broadcasts");
    await this.assertCanAccess(id, actor);
    const scheduledAt = this.parseUtcTimestamp(scheduledAtIso, "scheduledAt");
    if (scheduledAt.getTime() <= Date.now()) throw new BadRequestException("scheduledAt must be in the future");

    const broadcast = await this.getById(id);
    if ([BroadcastStatus.Cancelled, BroadcastStatus.Rejected, BroadcastStatus.Expired, BroadcastStatus.Dispatching].includes(broadcast.status as BroadcastStatus)) {
      throw new BadRequestException("Cancelled, rejected, expired, or dispatching broadcasts cannot be scheduled");
    }
    if ([BroadcastStatus.DispatchQueued, BroadcastStatus.Published].includes(broadcast.status as BroadcastStatus)) {
      const dispatchedCount = await this.prisma.broadcastDelivery.count({ where: { broadcastId: id } });
      if (dispatchedCount > 0) throw new BadRequestException("Broadcast cannot be rescheduled after dispatch has started");
    }

    await this.prisma.broadcast.update({
      where: { id },
      data: {
        scheduledAt,
        status: BroadcastStatus.Scheduled as never,
        dispatchQueuedAt: null,
        dispatchStartedAt: null,
        dispatchCompletedAt: null,
        dispatchFailureReason: null,
      } as never,
    });
    await this.audit(actor, "broadcast.scheduled", id, { scheduledAt: scheduledAt.toISOString(), actorType: "admin" });
    return { data: await this.getById(id), scheduledAt: scheduledAt.toISOString() };
  }

  async cancel(id: string, actor: JwtPayload, reason?: string) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can cancel broadcasts");
    await this.assertCanAccess(id, actor);
    const broadcast = await this.getById(id);
    if ([BroadcastStatus.Cancelled, BroadcastStatus.Rejected, BroadcastStatus.Expired].includes(broadcast.status as BroadcastStatus)) {
      throw new BadRequestException("Broadcast is already terminal");
    }

    const dispatchedCount = await this.prisma.broadcastDelivery.count({ where: { broadcastId: id } });
    if (dispatchedCount > 0) {
      throw new BadRequestException("Broadcast cannot be cancelled after recipient delivery has started");
    }
    if (broadcast.status === BroadcastStatus.Dispatching) {
      throw new BadRequestException("Broadcast cannot be cancelled while dispatch is in progress");
    }

    await this.prisma.broadcast.update({
      where: { id },
      data: {
        status: BroadcastStatus.Cancelled as never,
        scheduledAt: null,
        dispatchQueuedAt: null,
        dispatchStartedAt: null,
        rejectedReason: reason?.trim() || broadcast.rejectedReason,
      } as never,
    });
    await this.audit(actor, "broadcast.cancelled", id, { reason, actorType: "admin" });
    return { data: await this.getById(id) };
  }

  async retryFailed(id: string, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can retry broadcast deliveries");
    await this.assertCanAccess(id, actor);
    const broadcast = await this.getById(id);
    if (broadcast.status === BroadcastStatus.Failed) {
      await this.prisma.broadcast.update({
        where: { id },
        data: { status: BroadcastStatus.Published as never, dispatchFailureReason: null } as never,
      });
    }
    const current = await this.getById(id);
    if (current.status !== BroadcastStatus.Published) {
      throw new BadRequestException("Only published or failed broadcasts can be retried");
    }

    const failedDeliveries = await this.prisma.broadcastDelivery.findMany({
      where: { broadcastId: id, status: "Failed" as never },
      take: 100,
    });

    let retried = 0;
    for (const delivery of failedDeliveries) {
      if (delivery.notificationId) {
        const notification = await this.prisma.notification.findUnique({ where: { id: delivery.notificationId } });
        if (notification && (notification.status === "Sent" || notification.status === "Delivered" || notification.status === "Read")) {
          continue;
        }
        if (notification && notification.status === "Failed") {
          await this.notificationsService.enqueue({
            userId: delivery.userId,
            notificationId: notification.id,
            title: current.title,
            body: current.body,
            broadcastId: id,
            channel: "push",
            type: "BroadcastAlert",
            priority: this.notificationPriority(current.priority as string),
            provider: "firebase-cloud-messaging",
          });
          await this.prisma.broadcastDelivery.update({
            where: { id: delivery.id },
            data: { status: "Queued" as never },
          });
          retried += 1;
          continue;
        }
      }

      const recipient = { user_id: delivery.userId, distance_meters: Number(delivery.distanceMeters ?? 0) };
      await this.dispatchToRecipient(current, id, recipient);
      retried += 1;
    }

    await this.audit(actor, "broadcast.retry_failed", id, { retried });
    return { data: await this.getById(id), retried };
  }

  async deliveryProgress(id: string, actor: JwtPayload) {
    await this.assertCanAccess(id, actor);
    const grouped = await this.prisma.broadcastDelivery.groupBy({
      by: ["status"],
      where: { broadcastId: id },
      _count: { _all: true },
    });

    const counts = grouped.reduce<Record<string, number>>((acc, row) => {
      acc[String(row.status)] = row._count._all;
      return acc;
    }, {});

    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const sent = (counts.Sent ?? 0) + (counts.Delivered ?? 0);
    const failed = counts.Failed ?? 0;
    const queued = counts.Queued ?? 0;

    return {
      broadcastId: id,
      total,
      queued,
      sent,
      failed,
      delivered: counts.Delivered ?? 0,
      progressPercent: total > 0 ? Math.round(((sent + failed) / total) * 100) : 0,
      counts,
    };
  }

  private async dispatchToRecipient(
    broadcast: {
      incidentId?: string | null;
      title: string;
      body: string;
      priority: string;
      type?: string;
      country?: string | null;
      publishedAt?: Date | null;
    },
    id: string,
    recipient: { user_id: string; distance_meters: number | null },
    routingContext?: { countryCode: string; eventType: string },
  ) {
    const issuedAt = (broadcast.publishedAt ?? new Date()).toISOString();
    const routingMetadata = buildBroadcastNotificationMetadata({
      broadcastId: id,
      broadcastCategory: String(broadcast.type ?? "Broadcast"),
      countryCode: routingContext?.countryCode ?? String(broadcast.country ?? ""),
      issuedAt,
      eventType: routingContext?.eventType ?? "BROADCAST_ALERT",
    });
    // Idempotent: one BroadcastAlert notification per user+broadcast.
    const existing = await this.prisma.notification.findFirst({
      where: {
        userId: recipient.user_id,
        broadcastId: id,
        type: "BroadcastAlert",
      },
      orderBy: { createdAt: "desc" },
    });
    const notification = existing ?? await this.prisma.notification.create({
      data: {
        userId: recipient.user_id,
        broadcastId: id,
        incidentId: broadcast.incidentId,
        type: "BroadcastAlert",
        priority: this.notificationPriority(broadcast.priority as string),
        channel: "push",
        title: broadcast.title,
        body: broadcast.body,
        status: "Pending" as never,
        provider: "firebase-cloud-messaging",
        metadata: routingMetadata,
      } as never,
    });
    await this.prisma.broadcastDelivery.upsert({
      where: { broadcastId_userId: { broadcastId: id, userId: recipient.user_id } },
      update: { notificationId: notification.id, distanceMeters: recipient.distance_meters, status: "Queued" as never },
      create: {
        broadcastId: id,
        userId: recipient.user_id,
        notificationId: notification.id,
        distanceMeters: recipient.distance_meters,
        status: "Queued" as never,
        channel: "push",
      } as never,
    });
    if (existing) {
      return;
    }
    await this.notificationsService.enqueue({
      userId: recipient.user_id,
      notificationId: notification.id,
      title: broadcast.title,
      body: broadcast.body,
      broadcastId: id,
      channel: "push",
      type: "BroadcastAlert",
      priority: this.notificationPriority(broadcast.priority as string),
      provider: "firebase-cloud-messaging",
    });
  }

  async autoBroadcastVerifiedIncident(incidentId: string, confidenceScore: number) {
    if (confidenceScore < AUTO_BROADCAST_CONFIDENCE) return { skipped: true, reason: "confidence_below_threshold" };

    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException("Incident not found");
    const priority = incident.priority as unknown as IncidentPriority;
    if (incident.status !== IncidentStatus.Verified && incident.status !== IncidentStatus.Assigned && priority !== IncidentPriority.P1LifeThreatening) {
      return { skipped: true, reason: "incident_not_critical_or_verified" };
    }

    const type = this.typeFromIncident(incident.type as string);
    const systemAdmin = await this.prisma.adminUser.findFirst({ orderBy: { createdAt: "asc" } });
    if (!systemAdmin) throw new BadRequestException("Auto-broadcast requires at least one admin user for audit ownership");

    const broadcast = await this.prisma.broadcast.create({
      data: {
        jurisdictionId: incident.jurisdictionId,
        incidentId,
        creatorAdminId: systemAdmin.id,
        type: type as never,
        title: `Verified ${type} alert`,
        body: `${incident.title}. Avoid the affected area and follow official instructions.`,
        priority: priority as never,
        status: BroadcastStatus.Published as never,
        requiresApproval: false,
        autoPublished: true,
        targetRadiusMeters: priority === IncidentPriority.P1LifeThreatening ? 5000 : 2500,
        publishedAt: new Date(),
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      } as never,
    });

    await this.prisma.$executeRawUnsafe(
      `UPDATE broadcasts SET target_center = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, target_area = ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)::geometry)::geography WHERE id = $4::uuid`,
      Number(incident.longitude),
      Number(incident.latitude),
      priority === IncidentPriority.P1LifeThreatening ? 5000 : 2500,
      broadcast.id,
    );

    return this.dispatch(broadcast.id, { typ: "admin", sub: systemAdmin.id, permissions: ["broadcast:publish"] } as JwtPayload, "broadcast.auto_published");
  }

  async countryFeedForUser(
    userId: string,
    query: {
      cursor?: string;
      limit?: number;
      category?: string;
      severity?: string;
      unreadOnly?: boolean;
    } = {},
  ) {
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const params: unknown[] = [userId];
    let paramIndex = 2;
    let filterSql = "";

    if (query.category) {
      filterSql += ` AND b.type = $${paramIndex++}`;
      params.push(query.category);
    }
    if (query.severity) {
      filterSql += ` AND b.priority = $${paramIndex++}`;
      params.push(query.severity);
    }
    if (query.unreadOnly) {
      filterSql += ` AND NOT (
        EXISTS (SELECT 1 FROM broadcast_reads br WHERE br.broadcast_id = b.id AND br.user_id = $1::uuid)
        OR EXISTS (
          SELECT 1 FROM broadcast_deliveries bd
          WHERE bd.broadcast_id = b.id AND bd.user_id = $1::uuid AND bd.read_at IS NOT NULL
        )
      )`;
    }
    if (cursor) {
      filterSql += ` AND (b.published_at, b.id) < ($${paramIndex++}::timestamptz, $${paramIndex++}::uuid)`;
      params.push(cursor.createdAt, cursor.id);
    }

    params.push(limit + 1);

    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT b.id,
              b.type,
              b.title,
              b.body,
              b.priority,
              b.status,
              b.author_type,
              b.admin_verified,
              b.country,
              b.state,
              b.published_at,
              b.expires_at,
              b.metadata,
              b.creator_user_id,
              (SELECT COUNT(*)::int FROM broadcast_comments bc WHERE bc.broadcast_id = b.id AND bc.hidden_at IS NULL) AS comments_count,
              NULL::double precision AS distance_meters,
              CASE
                WHEN EXISTS (SELECT 1 FROM broadcast_reads br WHERE br.broadcast_id = b.id AND br.user_id = $1::uuid) THEN TRUE
                WHEN EXISTS (
                  SELECT 1 FROM broadcast_deliveries bd
                  WHERE bd.broadcast_id = b.id AND bd.user_id = $1::uuid AND bd.read_at IS NOT NULL
                ) THEN TRUE
                ELSE FALSE
              END AS read
         FROM broadcasts b
         LEFT JOIN profiles p ON p.user_id = $1::uuid
         LEFT JOIN jurisdictions j ON j.id = b.jurisdiction_id
        WHERE b.status IN (${LIVE_BROADCAST_STATUS_SQL})
          AND b.deleted_at IS NULL
          AND (b.expires_at IS NULL OR b.expires_at > NOW())
          AND p.user_id IS NOT NULL
          AND COALESCE(b.country, j.country) = p.country
          ${filterSql}
        ORDER BY ${PRIORITY_ORDER_SQL}
        LIMIT $${paramIndex}`,
      ...params,
    ) as Array<Record<string, unknown>>;

    const page = buildCursorPage(rows, limit, (item) =>
      encodeDateIdCursor(new Date(String(item.published_at ?? new Date().toISOString())), String(item.id)),
    );

    return {
      data: await Promise.all(page.data.map((row) => this.toCitizenFeedItem(row))),
      nextCursor: page.nextCursor,
    };
  }

  async countryFeed(
    actor: JwtPayload,
    query: {
      cursor?: string;
      limit?: number;
      category?: string;
      severity?: string;
      unreadOnly?: boolean;
    } = {},
  ) {
    if (actor.typ === "user") return this.countryFeedForUser(actor.sub, query);
    if (actor.typ !== "field") throw new ForbiddenException("Country broadcast feed is unavailable");
    if (!actor.country) throw new ForbiddenException("Field session country is required");
    return this.countryFeedForField(actor.country, query);
  }

  private async countryFeedForField(
    country: string,
    query: {
      cursor?: string;
      limit?: number;
      category?: string;
      severity?: string;
      unreadOnly?: boolean;
    },
  ) {
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const params: unknown[] = [country];
    let paramIndex = 2;
    let filterSql = "";

    if (query.category) {
      filterSql += ` AND b.type = $${paramIndex++}`;
      params.push(query.category);
    }
    if (query.severity) {
      filterSql += ` AND b.priority = $${paramIndex++}`;
      params.push(query.severity);
    }
    if (cursor) {
      filterSql += ` AND (b.published_at, b.id) < ($${paramIndex++}::timestamptz, $${paramIndex++}::uuid)`;
      params.push(cursor.createdAt, cursor.id);
    }
    params.push(limit + 1);

    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT b.id,
              b.type,
              b.title,
              b.body,
              b.priority,
              b.status,
              b.author_type,
              b.admin_verified,
              b.country,
              b.state,
              b.published_at,
              b.expires_at,
              b.metadata,
              (SELECT COUNT(*)::int FROM broadcast_comments bc WHERE bc.broadcast_id = b.id AND bc.hidden_at IS NULL) AS comments_count,
              NULL::double precision AS distance_meters,
              FALSE AS read
         FROM broadcasts b
         LEFT JOIN jurisdictions j ON j.id = b.jurisdiction_id
        WHERE b.status IN (${LIVE_BROADCAST_STATUS_SQL})
          AND b.deleted_at IS NULL
          AND (b.expires_at IS NULL OR b.expires_at > NOW())
          AND COALESCE(b.country, j.country) = $1
          ${filterSql}
        ORDER BY ${PRIORITY_ORDER_SQL}
        LIMIT $${paramIndex}`,
      ...params,
    ) as Array<Record<string, unknown>>;

    const page = buildCursorPage(rows, limit, (item) =>
      encodeDateIdCursor(new Date(String(item.published_at ?? new Date().toISOString())), String(item.id)),
    );
    return {
      data: await Promise.all(page.data.map((row) => this.toCitizenFeedItem(row))),
      nextCursor: page.nextCursor,
    };
  }

  async getForCitizen(id: string, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    if (!isBroadcastId(id)) throw new NotFoundException("Broadcast not found");
    const row = await this.findCitizenBroadcastRow(id, actor.sub);
    if (!row) throw new NotFoundException("Broadcast not found");
    return { data: await this.toCitizenFeedItem(row, true) };
  }

  async markRead(id: string, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    if (!isBroadcastId(id)) throw new NotFoundException("Broadcast not found");
    const row = await this.findCitizenBroadcastRow(id, actor.sub);
    if (!row) throw new NotFoundException("Broadcast not found");
    await this.prisma.broadcastRead.upsert({
      where: { broadcastId_userId: { broadcastId: id, userId: actor.sub } },
      update: { readAt: new Date() },
      create: { broadcastId: id, userId: actor.sub },
    });
    await this.audit(actor, "broadcast.read", id, { actorType: "user" });
    return { data: { id, read: true } };
  }

  async unreadCount(userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) AS count
         FROM broadcasts b
        WHERE b.status IN (${LIVE_BROADCAST_STATUS_SQL})
          AND b.deleted_at IS NULL
          AND (b.expires_at IS NULL OR b.expires_at > NOW())
          AND (
            EXISTS (SELECT 1 FROM broadcast_deliveries bd WHERE bd.broadcast_id = b.id AND bd.user_id = $1::uuid)
            OR EXISTS (
              SELECT 1
                FROM profiles p
               WHERE p.user_id = $1::uuid
                 AND b.country IS NOT NULL
                 AND b.country = p.country
            )
            OR EXISTS (
              SELECT 1
                FROM profiles p
                JOIN jurisdictions j ON j.id = b.jurisdiction_id
               WHERE p.user_id = $1::uuid
                 AND j.country = p.country
            )
          )
          AND NOT EXISTS (SELECT 1 FROM broadcast_reads br WHERE br.broadcast_id = b.id AND br.user_id = $1::uuid)
          AND NOT EXISTS (
            SELECT 1 FROM broadcast_deliveries bd
            WHERE bd.broadcast_id = b.id AND bd.user_id = $1::uuid AND bd.read_at IS NOT NULL
          )`,
      userId,
    );
    return { unreadCount: Number(rows[0]?.count ?? 0) };
  }

  private async getById(id: string) {
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id },
      include: {
        deliveries: true,
        notifications: true,
        sightings: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            observedAt: true,
            approximateArea: true,
            description: true,
            metadata: true,
            createdAt: true,
          },
        },
        _count: {
          select: { comments: true, reports: true, deliveries: true, sightings: true },
        },
      },
    });
    if (!broadcast) throw new NotFoundException("Broadcast not found");
    return broadcast;
  }

  private async assertCanAccess(id: string, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can access broadcast operations");
    const broadcast = await this.getById(id);
    const scope = this.scopeWhere(actor);
    if (Object.keys(scope).length === 0) return broadcast;
    const rows = await this.prisma.broadcast.findMany({ where: { id, ...scope }, take: 1 });
    if (!rows.length) throw new ForbiddenException("Broadcast is outside your jurisdiction");
    return broadcast;
  }

  private requiresApproval(type: BroadcastType, priority: IncidentPriority) {
    if (priority === IncidentPriority.P1LifeThreatening && [BroadcastType.Emergency, BroadcastType.Crime, BroadcastType.Accident].includes(type)) return false;
    return approvalRequiredTypes.has(type);
  }

  private scopeWhere(actor: JwtPayload) {
    if (actor.typ !== "admin") return { notifications: { some: { userId: actor.sub } } } as never;
    if (actor.role === "Super Admin") return {};
    return {
      OR: [
        { creatorAdminId: actor.sub },
        { country: actor.country },
        { jurisdiction: { country: actor.country } },
      ],
    } as never;
  }

  private async inferJurisdictionId(dto: CreateBroadcastDto) {
    if (dto.incidentId) {
      const incident = await this.prisma.incident.findUnique({ where: { id: dto.incidentId } });
      return incident?.jurisdictionId;
    }
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      const rows = await this.prisma.$queryRawUnsafe(
        `SELECT id FROM jurisdictions WHERE ST_Contains(boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326)) LIMIT 1`,
        dto.longitude,
        dto.latitude,
      ) as Array<{ id: string }>;
      return rows[0]?.id;
    }
    return dto.jurisdictionId;
  }

  private async writeGeofence(id: string, dto: CreateBroadcastDto) {
    if (dto.targetAreaWkt) {
      await this.prisma.$executeRawUnsafe(`UPDATE broadcasts SET target_area = ST_Multi(ST_GeomFromText($1, 4326))::geography WHERE id = $2::uuid`, dto.targetAreaWkt, id);
      return;
    }
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      const radius = dto.radiusMeters ?? 5000;
      await this.prisma.$executeRawUnsafe(
        `UPDATE broadcasts SET target_center = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, target_area = ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)::geometry)::geography WHERE id = $4::uuid`,
        dto.longitude,
        dto.latitude,
        radius,
        id,
      );
      return;
    }
    if (dto.jurisdictionId) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE broadcasts b SET target_area = j.boundary FROM jurisdictions j WHERE b.id = $1::uuid AND j.id = $2::uuid`,
        id,
        dto.jurisdictionId,
      );
    }
  }

  private async deliverToRecipients(
    broadcast: {
      incidentId?: string | null;
      title: string;
      body: string;
      priority: string;
      type?: string;
      country?: string | null;
      publishedAt?: Date | null;
    },
    id: string,
    recipients: Array<{ user_id: string; distance_meters: number | null }>,
    actor: JwtPayload,
    action: string,
    routingContext?: { countryCode: string; eventType: string; batchNumber?: number },
  ) {
    for (let offset = 0; offset < recipients.length; offset += DISPATCH_BATCH_SIZE) {
      const batch = recipients.slice(offset, offset + DISPATCH_BATCH_SIZE);
      await Promise.all(
        batch.map((recipient) => this.dispatchToRecipient(broadcast, id, recipient, routingContext)),
      );
    }
    await this.audit(actor, action, id, {
      recipientCount: recipients.length,
      actorType: actor.sub === "system" ? "system" : actor.typ,
      ...(routingContext ?? {}),
    });
  }

  private async expandRecipients(broadcastId: string) {
    return this.findCountryRecipients(broadcastId);
  }

  private parseUtcTimestamp(value: string, label: string) {
    if (!value || typeof value !== "string") throw new BadRequestException(`${label} must be an ISO-8601 timestamp`);
    if (!value.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(value)) {
      throw new BadRequestException(`${label} must include an explicit UTC offset or Z suffix`);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`${label} must be a valid ISO timestamp`);
    return parsed;
  }

  private async toCitizenFeedItem(row: Record<string, unknown>, includeBody = false) {
    const publishedAt = row.published_at ? new Date(String(row.published_at)) : null;
    const expiresAt = row.expires_at ? new Date(String(row.expires_at)) : null;
    const expired = expiresAt ? expiresAt.getTime() <= Date.now() : false;
    const authorType = String(row.author_type ?? "Admin");
    const adminVerified = row.admin_verified === true || row.admin_verified === "t";
    const authorLabel =
      authorType === "Citizen"
        ? adminVerified
          ? "Verified by Admin"
          : "Citizen Broadcast"
        : adminVerified
          ? "Verified by Admin"
          : "Admin Broadcast";
    const metadata = await this.projectCitizenMetadata(row.metadata, String(row.id));
    return {
      id: String(row.id),
      type: String(row.type),
      title: String(row.title),
      body: includeBody ? String(row.body ?? "") : String(row.body ?? ""),
      priority: String(row.priority),
      category: String(row.type),
      severity: String(row.priority),
      status: String(row.status ?? "Active"),
      country: row.country ? String(row.country) : null,
      state: row.state ? String(row.state) : null,
      authorLabel,
      adminVerified,
      creatorUserId: row.creator_user_id ? String(row.creator_user_id) : null,
      commentsCount: row.comments_count != null ? Number(row.comments_count) : 0,
      publishedAt: publishedAt?.toISOString() ?? null,
      expiresAt: expiresAt?.toISOString() ?? null,
      expired,
      read: row.read === true || row.read === "t",
      distanceMeters: row.distance_meters != null ? Number(row.distance_meters) : null,
      deepLink: `/broadcasts/${String(row.id)}`,
      metadata,
    };
  }

  private async projectCitizenMetadata(raw: unknown, broadcastId?: string): Promise<Record<string, unknown>> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const source = raw as Record<string, unknown>;
    const allowedKeys = [
      "fullName",
      "ageOrApproximateAge",
      "gender",
      "lastSeenAt",
      "lastSeenAddress",
      "clothingDescription",
      "physicalDescription",
      "additionalDescription",
      "vehicleType",
      "make",
      "model",
      "year",
      "colour",
      "registrationMasked",
      "registrationNumber",
      "vin",
      "vinLastFour",
      "stolenAt",
      "lastSeenAt",
      "distinguishingFeatures",
      "theftDescription",
      "lastKnownLocation",
    ] as const;
    const projected: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (source[key] != null && source[key] !== "") projected[key] = source[key];
    }
    const mediaClient = (this.prisma as any).broadcastMedia;
    const rawVehiclePhotos = Array.isArray(source.vehiclePhotos)
      ? source.vehiclePhotos
      : [];
    const vehicleAngleByObjectKey = new Map(
      rawVehiclePhotos
        .filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object"),
        )
        .map((item) => [
          String(item.objectKey ?? ""),
          String(item.angle ?? "OTHER"),
        ]),
    );
    if (broadcastId && typeof mediaClient?.findMany === "function") {
      const rows = await mediaClient.findMany({
        where: { broadcastId, sightingId: null, deletedAt: null },
        orderBy: { createdAt: "asc" },
      });
      const projectedMedia = await Promise.all(rows.map(async (row: Record<string, unknown>) => {
        let url = "";
        try {
          url = (await createStorageDownloadUrl(String(row.objectKey), 600)).url;
        } catch {
          url = "";
        }
        return {
          id: String(row.id),
          mediaType: String(row.mediaType).toLowerCase(),
          objectKey: String(row.objectKey),
          bucket: String(row.bucket),
          contentType: String(row.contentType),
          durationSeconds: row.durationSeconds == null ? null : Number(row.durationSeconds),
          transcriptionStatus: row.transcriptionStatus ?? null,
          selectedLanguage: row.selectedLanguage ?? null,
          detectedLanguage: row.detectedLanguage ?? null,
          role: String(row.role),
          ...(String(row.role) === "VehiclePhoto"
            ? { angle: vehicleAngleByObjectKey.get(String(row.objectKey)) ?? "OTHER" }
            : {}),
          url,
        };
      }));
      const incidentEvidence = projectedMedia.filter((row) => row.role === "IncidentEvidence");
      const vehiclePhotos = projectedMedia.filter((row) => row.role === "VehiclePhoto");
      if (incidentEvidence.length > 0) projected.attachments = incidentEvidence;
      if (vehiclePhotos.length > 0) projected.vehiclePhotos = vehiclePhotos;
    }
    if (!projected.vehiclePhotos && Array.isArray(source.savedVehiclePhotos)) {
      const savedPhotos = source.savedVehiclePhotos
        .filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object"),
        )
        .slice(0, 8);
      const signedSavedPhotos = await Promise.all(
        savedPhotos.map(async (row) => {
          const objectKey = String(row.objectKey ?? "");
          let url = "";
          try {
            url = objectKey
              ? (await createStorageDownloadUrl(objectKey, 600)).url
              : "";
          } catch {
            url = "";
          }
          return {
            id: String(row.id ?? objectKey),
            mediaType: "image",
            objectKey,
            contentType: String(row.contentType ?? "image/jpeg"),
            angle: String(row.angle ?? "OTHER"),
            role: "VehiclePhoto",
            url,
          };
        }),
      );
      if (signedSavedPhotos.length > 0) {
        projected.vehiclePhotos = signedSavedPhotos;
      }
    }
    const attachmentsRaw = source.attachments;
    if (!projected.attachments && Array.isArray(attachmentsRaw)) {
      const attachments: Array<Record<string, string>> = [];
      let photoCount = 0;
      let videoCount = 0;
      let audioCount = 0;
      for (const item of attachmentsRaw) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        const mediaType = String(row.mediaType ?? "").toLowerCase();
        const objectKey = String(row.objectKey ?? "");
        if (!objectKey || !["image", "video", "audio"].includes(mediaType)) continue;
        let label = String(row.label ?? "").trim();
        if (!label) {
          if (mediaType === "image") {
            photoCount += 1;
            label = `Photo ${photoCount}`;
          } else if (mediaType === "video") {
            videoCount += 1;
            label = `Video ${videoCount}`;
          } else {
            audioCount += 1;
            label = `Audio ${audioCount}`;
          }
        }
        let url = "";
        try {
          url = (await createStorageDownloadUrl(objectKey, 600)).url;
        } catch {
          url = "";
        }
        attachments.push({
          mediaType,
          objectKey,
          bucket: String(row.bucket ?? ""),
          contentType: String(row.contentType ?? ""),
          label,
          url,
        });
      }
      if (attachments.length > 0) projected.attachments = attachments;
    }
    return projected;
  }

  private async findCitizenBroadcastRow(id: string, userId: string) {
    // Notification deep links and "My broadcasts" must still open after resolve /
    // withdraw / expiry. Creators and prior delivery recipients get historical
    // read access; live audience matching stays limited to non-expired live rows.
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT b.id, b.type, b.title, b.body, b.priority, b.status, b.author_type, b.admin_verified,
              b.country, b.state, b.published_at, b.expires_at, b.metadata, b.creator_user_id,
              (SELECT COUNT(*)::int FROM broadcast_comments bc WHERE bc.broadcast_id = b.id AND bc.hidden_at IS NULL) AS comments_count,
              CASE
                WHEN EXISTS (SELECT 1 FROM broadcast_reads br WHERE br.broadcast_id = b.id AND br.user_id = $2::uuid) THEN TRUE
                WHEN EXISTS (
                  SELECT 1 FROM broadcast_deliveries bd
                  WHERE bd.broadcast_id = b.id AND bd.user_id = $2::uuid AND bd.read_at IS NOT NULL
                ) THEN TRUE
                ELSE FALSE
              END AS read
         FROM broadcasts b
         LEFT JOIN profiles p ON p.user_id = $2::uuid
         LEFT JOIN jurisdictions j ON j.id = b.jurisdiction_id
        WHERE b.id = $1::uuid
          AND b.deleted_at IS NULL
          AND b.status <> 'DeletedByAdmin'
          AND (
            b.creator_user_id = $2::uuid
            OR EXISTS (SELECT 1 FROM broadcast_deliveries bd WHERE bd.broadcast_id = b.id AND bd.user_id = $2::uuid)
            OR (
              b.status IN (${LIVE_BROADCAST_STATUS_SQL})
              AND (b.expires_at IS NULL OR b.expires_at > NOW())
              AND p.user_id IS NOT NULL
              AND COALESCE(b.country, j.country) = p.country
            )
          )
        LIMIT 1`,
      id,
      userId,
    );
    return rows[0] ?? null;
  }

  private async findCountryRecipients(broadcastId: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT u.id AS user_id,
              NULL::double precision AS distance_meters
          FROM broadcasts b
          LEFT JOIN jurisdictions j ON j.id = b.jurisdiction_id
          JOIN profiles p ON p.country = COALESCE(b.country, j.country)
          JOIN users u ON u.id = p.user_id AND u.status = 'Active'
         WHERE b.id = $1::uuid
         ORDER BY u.created_at ASC`,
      broadcastId,
    ) as Promise<Array<{ user_id: string; distance_meters: number | null }>>;
  }

  private typeFromIncident(type: string) {
    if (type === "Crime") return BroadcastType.Crime;
    if (type === "Accident") return BroadcastType.Accident;
    if (type === "MissingPerson") return BroadcastType.MissingPerson;
    if (type === "StolenVehicle") return BroadcastType.StolenVehicle;
    return BroadcastType.Emergency;
  }

  private notificationPriority(priority: string) {
    if (priority === "P1LifeThreatening") return "Critical";
    if (priority === "P2ActiveCrimeAccident" || priority === "P3SuspiciousActivity") return "High";
    return "Normal";
  }

  private audit(actor: JwtPayload, action: string, entityId: string, metadata: Record<string, unknown>) {
    return this.auditService.record({
      actor,
      action,
      entityType: "broadcasts",
      entityId,
      reason: typeof metadata.reason === "string" ? metadata.reason : typeof metadata.note === "string" ? metadata.note : undefined,
      metadata,
    });
  }

  async executeCountryDeliveryBatch(payload: BroadcastCountryDeliveryJobPayload) {
    const broadcast = await this.getById(payload.broadcastId);
    if (!LIVE_BROADCAST_STATUSES.has(String(broadcast.status))) {
      return { skipped: true, reason: "broadcast_not_live" };
    }
    const recipients = await this.findCountryRecipientBatch(
      payload.countryCode,
      payload.batchSize,
      payload.batchNumber * payload.batchSize,
    );
    if (!recipients.length) {
      await this.prisma.broadcast.update({
        where: { id: payload.broadcastId },
        data: { dispatchCompletedAt: new Date() } as never,
      });
      return { delivered: 0, completed: true };
    }

    await this.deliverToRecipients(
      broadcast,
      payload.broadcastId,
      recipients.map((userId) => ({ user_id: userId, distance_meters: null })),
      BROADCAST_SYSTEM_ACTOR,
      "broadcast.country_delivery_batch",
      {
        countryCode: payload.countryCode,
        batchNumber: payload.batchNumber,
        eventType:
          broadcast.type === BroadcastType.StolenVehicle
            ? "STOLEN_VEHICLE_BROADCAST"
            : broadcast.type === BroadcastType.MissingPerson
              ? "MISSING_PERSON_BROADCAST"
              : "BROADCAST_ALERT",
      },
    );

    return { delivered: recipients.length, completed: recipients.length < payload.batchSize };
  }

  private async findCountryRecipientBatch(countryCode: string, limit: number, offset: number) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ user_id: string }>>(
      `SELECT u.id AS user_id
         FROM users u
         JOIN profiles p ON p.user_id = u.id
        WHERE p.country = $1
          AND u.status = 'Active'
        ORDER BY u.created_at ASC
        LIMIT $2 OFFSET $3`,
      countryCode,
      limit,
      offset,
    );
    return rows.map((row) => row.user_id);
  }
}
