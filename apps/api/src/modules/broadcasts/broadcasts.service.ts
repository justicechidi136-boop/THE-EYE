import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BroadcastStatus, BroadcastType, IncidentPriority, IncidentStatus } from "@the-eye/shared";
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
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { approvalRequiredTypes, CreateBroadcastDto, validateCreateBroadcastDto } from "./dto/broadcast.dto";

import { BroadcastSchedulerDiagnosticsService } from "./broadcast-scheduler-diagnostics.service";

export const BROADCAST_SYSTEM_ACTOR: JwtPayload = {
  typ: "admin",
  sub: "system",
  permissions: ["broadcast:publish", "broadcast:approve"],
  role: "Super Admin",
};

const AUTO_BROADCAST_CONFIDENCE = 85;
const DISPATCH_BATCH_SIZE = 25;
const PRIORITY_ORDER_SQL = `
  CASE b.priority
    WHEN 'P1LifeThreatening' THEN 1
    WHEN 'P2ActiveCrimeAccident' THEN 2
    WHEN 'P3SuspiciousActivity' THEN 3
    ELSE 4
  END ASC,
  b.published_at DESC NULLS LAST,
  b.id DESC`;

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
      if (broadcast.status !== BroadcastStatus.Published) {
        throw new BadRequestException("Broadcast must be published before dispatch");
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
    broadcast: { incidentId?: string | null; title: string; body: string; priority: string },
    id: string,
    recipient: { user_id: string; distance_meters: number },
  ) {
    const notification = await this.prisma.notification.create({
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

  async nearbyForUser(
    userId: string,
    latitude: number,
    longitude: number,
    query: {
      radiusMeters?: number;
      cursor?: string;
      limit?: number;
      category?: string;
      severity?: string;
      unreadOnly?: boolean;
    } = {},
  ) {
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) throw new BadRequestException("latitude and longitude are required");
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const radiusMeters = query.radiusMeters ?? 10000;

    const params: unknown[] = [longitude, latitude, radiusMeters, userId];
    let paramIndex = 5;
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
        EXISTS (SELECT 1 FROM broadcast_reads br WHERE br.broadcast_id = b.id AND br.user_id = $4::uuid)
        OR EXISTS (
          SELECT 1 FROM broadcast_deliveries bd
          WHERE bd.broadcast_id = b.id AND bd.user_id = $4::uuid AND bd.read_at IS NOT NULL
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
              b.published_at,
              b.expires_at,
              ST_Distance(
                COALESCE(b.target_center, ST_Centroid(b.target_area::geometry)::geography),
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
              ) AS distance_meters,
              CASE
                WHEN EXISTS (SELECT 1 FROM broadcast_reads br WHERE br.broadcast_id = b.id AND br.user_id = $4::uuid) THEN TRUE
                WHEN EXISTS (
                  SELECT 1 FROM broadcast_deliveries bd
                  WHERE bd.broadcast_id = b.id AND bd.user_id = $4::uuid AND bd.read_at IS NOT NULL
                ) THEN TRUE
                ELSE FALSE
              END AS read
         FROM broadcasts b
         LEFT JOIN profiles p ON p.user_id = $4::uuid
         LEFT JOIN jurisdictions j ON j.id = b.jurisdiction_id
        WHERE b.status = 'Published'
          AND (b.expires_at IS NULL OR b.expires_at > NOW())
          AND (
            ST_DWithin(
              COALESCE(b.target_center, ST_Centroid(b.target_area::geometry)::geography),
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
              $3
            )
            OR EXISTS (SELECT 1 FROM broadcast_deliveries bd WHERE bd.broadcast_id = b.id AND bd.user_id = $4::uuid)
            OR (
              p.user_id IS NOT NULL
              AND j.id IS NOT NULL
              AND j.country = p.country
              AND j.state = p.state
              AND j.lga = p.lga
            )
          )
          ${filterSql}
        ORDER BY ${PRIORITY_ORDER_SQL}
        LIMIT $${paramIndex}`,
      ...params,
    ) as Array<Record<string, unknown>>;

    const page = buildCursorPage(rows, limit, (item) =>
      encodeDateIdCursor(new Date(String(item.published_at ?? new Date().toISOString())), String(item.id)),
    );

    return {
      data: page.data.map((row) => this.toCitizenFeedItem(row)),
      nextCursor: page.nextCursor,
    };
  }

  async getForCitizen(id: string, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    const row = await this.findCitizenBroadcastRow(id, actor.sub);
    if (!row) throw new NotFoundException("Broadcast not found");
    return { data: this.toCitizenFeedItem(row, true) };
  }

  async markRead(id: string, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
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
        WHERE b.status = 'Published'
          AND (b.expires_at IS NULL OR b.expires_at > NOW())
          AND (
            EXISTS (SELECT 1 FROM broadcast_deliveries bd WHERE bd.broadcast_id = b.id AND bd.user_id = $1::uuid)
            OR EXISTS (
              SELECT 1
                FROM profiles p
                JOIN jurisdictions j ON j.id = b.jurisdiction_id
               WHERE p.user_id = $1::uuid
                 AND j.country = p.country
                 AND j.state = p.state
                 AND j.lga = p.lga
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
    const broadcast = await this.prisma.broadcast.findUnique({ where: { id }, include: { deliveries: true, notifications: true } });
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
    if (actor.agencyId) return { OR: [{ creatorAdminId: actor.sub }, { incident: { assignedAgencyId: actor.agencyId } }] } as never;
    return {
      OR: [
        { creatorAdminId: actor.sub },
        { jurisdiction: { country: actor.country, state: actor.state, lga: actor.lga } },
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
    broadcast: { incidentId?: string | null; title: string; body: string; priority: string },
    id: string,
    recipients: Array<{ user_id: string; distance_meters: number }>,
    actor: JwtPayload,
    action: string,
  ) {
    for (let offset = 0; offset < recipients.length; offset += DISPATCH_BATCH_SIZE) {
      const batch = recipients.slice(offset, offset + DISPATCH_BATCH_SIZE);
      await Promise.all(batch.map((recipient) => this.dispatchToRecipient(broadcast, id, recipient)));
    }
    await this.audit(actor, action, id, { recipientCount: recipients.length, actorType: actor.sub === "system" ? "system" : "admin" });
  }

  private async expandRecipients(broadcastId: string) {
    return this.findGeofencedRecipients(broadcastId);
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

  private toCitizenFeedItem(row: Record<string, unknown>, includeBody = false) {
    const publishedAt = row.published_at ? new Date(String(row.published_at)) : null;
    const expiresAt = row.expires_at ? new Date(String(row.expires_at)) : null;
    const expired = expiresAt ? expiresAt.getTime() <= Date.now() : false;
    return {
      id: String(row.id),
      type: String(row.type),
      title: String(row.title),
      body: includeBody ? String(row.body ?? "") : String(row.body ?? ""),
      priority: String(row.priority),
      category: String(row.type),
      severity: String(row.priority),
      publishedAt: publishedAt?.toISOString() ?? null,
      expiresAt: expiresAt?.toISOString() ?? null,
      expired,
      read: row.read === true || row.read === "t",
      distanceMeters: row.distance_meters != null ? Number(row.distance_meters) : null,
      deepLink: `/broadcasts/${String(row.id)}`,
    };
  }

  private async findCitizenBroadcastRow(id: string, userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT b.id, b.type, b.title, b.body, b.priority, b.published_at, b.expires_at,
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
          AND b.status = 'Published'
          AND (b.expires_at IS NULL OR b.expires_at > NOW())
          AND (
            EXISTS (SELECT 1 FROM broadcast_deliveries bd WHERE bd.broadcast_id = b.id AND bd.user_id = $2::uuid)
            OR (
              p.user_id IS NOT NULL
              AND j.id IS NOT NULL
              AND j.country = p.country
              AND j.state = p.state
              AND j.lga = p.lga
            )
            OR EXISTS (
              SELECT 1 FROM broadcast_deliveries bd WHERE bd.broadcast_id = b.id AND bd.user_id = $2::uuid
            )
          )
        LIMIT 1`,
      id,
      userId,
    );
    return rows[0] ?? null;
  }

  private async findGeofencedRecipients(broadcastId: string) {
    return this.prisma.$queryRawUnsafe(
      `WITH latest_user_location AS (
          SELECT DISTINCT ON (u.id) u.id AS user_id,
                 COALESCE(i.gps_location, s.gps_location) AS gps_location
            FROM users u
            LEFT JOIN incidents i ON i.reporter_id = u.id
            LEFT JOIN sos_events s ON s.user_id = u.id
           WHERE COALESCE(i.gps_location, s.gps_location) IS NOT NULL
           ORDER BY u.id, i.created_at DESC NULLS LAST, s.triggered_at DESC NULLS LAST
        )
        SELECT lul.user_id,
               ST_Distance(lul.gps_location, COALESCE(b.target_center, ST_Centroid(b.target_area::geometry)::geography)) AS distance_meters
          FROM broadcasts b
          JOIN latest_user_location lul ON ST_Intersects(lul.gps_location, b.target_area)
         WHERE b.id = $1::uuid`,
      broadcastId,
    ) as Promise<Array<{ user_id: string; distance_meters: number }>>;
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
}
