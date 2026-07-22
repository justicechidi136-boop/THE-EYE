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

const AUTO_BROADCAST_CONFIDENCE = 85;
const DISPATCH_BATCH_SIZE = 25;

@Injectable()
export class BroadcastsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly metrics: MetricsService,
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
    const status = saveAsDraft
      ? BroadcastStatus.Draft
      : requiresApproval
        ? BroadcastStatus.PendingApproval
        : BroadcastStatus.Published;
    const jurisdictionId = dto.jurisdictionId ?? (await this.inferJurisdictionId(dto));
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : undefined;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException("scheduledAt must be a valid ISO timestamp");
    }

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
    await this.audit(actor, "broadcast.created", broadcast.id, { status, type: dto.type, requiresApproval });

    if (status === BroadcastStatus.Published) {
      await this.dispatch(broadcast.id, actor, "broadcast.published");
    }

    return { data: await this.getById(broadcast.id) };
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
      if (broadcast.status !== BroadcastStatus.Published) throw new BadRequestException("Broadcast must be published before dispatch");

      const recipients = await this.findGeofencedRecipients(id);
      for (let offset = 0; offset < recipients.length; offset += DISPATCH_BATCH_SIZE) {
        const batch = recipients.slice(offset, offset + DISPATCH_BATCH_SIZE);
        await Promise.all(batch.map((recipient) => this.dispatchToRecipient(broadcast, id, recipient)));
      }

      await this.audit(actor, action, id, { recipientCount: recipients.length });
      this.metrics.recordBroadcastDispatch((Date.now() - startedAt) / 1000, "success");
      return { data: await this.getById(id), recipientCount: recipients.length };
    } catch (error) {
      this.metrics.recordBroadcastDispatch((Date.now() - startedAt) / 1000, "error");
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
    const recipients = await this.findGeofencedRecipients(id);
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
    const scheduledAt = new Date(scheduledAtIso);
    if (Number.isNaN(scheduledAt.getTime())) throw new BadRequestException("scheduledAt must be a valid ISO timestamp");
    if (scheduledAt.getTime() <= Date.now()) throw new BadRequestException("scheduledAt must be in the future");

    const broadcast = await this.getById(id);
    if ([BroadcastStatus.Cancelled, BroadcastStatus.Rejected, BroadcastStatus.Expired].includes(broadcast.status as BroadcastStatus)) {
      throw new BadRequestException("Cancelled, rejected, or expired broadcasts cannot be scheduled");
    }

    await this.prisma.broadcast.update({
      where: { id },
      data: {
        scheduledAt,
        status: broadcast.status === BroadcastStatus.Published ? BroadcastStatus.Published : BroadcastStatus.Draft,
      } as never,
    });
    await this.audit(actor, "broadcast.scheduled", id, { scheduledAt: scheduledAt.toISOString() });
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
      throw new BadRequestException("Broadcast cannot be cancelled after dispatch has started");
    }

    await this.prisma.broadcast.update({
      where: { id },
      data: {
        status: BroadcastStatus.Cancelled as never,
        scheduledAt: null,
        rejectedReason: reason?.trim() || broadcast.rejectedReason,
      } as never,
    });
    await this.audit(actor, "broadcast.cancelled", id, { reason });
    return { data: await this.getById(id) };
  }

  async retryFailed(id: string, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can retry broadcast deliveries");
    await this.assertCanAccess(id, actor);
    const broadcast = await this.getById(id);
    if (broadcast.status !== BroadcastStatus.Published) {
      throw new BadRequestException("Only published broadcasts can be retried");
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
            title: broadcast.title,
            body: broadcast.body,
            broadcastId: id,
            channel: "push",
            type: "BroadcastAlert",
            priority: this.notificationPriority(broadcast.priority as string),
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
      await this.dispatchToRecipient(broadcast, id, recipient);
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

  async nearbyForUser(userId: string, latitude: number, longitude: number, radiusMeters = 10000) {
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) throw new BadRequestException("latitude and longitude are required");
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT b.id, b.type, b.title, b.body, b.priority, b.published_at, b.expires_at,
              ST_Distance(COALESCE(b.target_center, ST_Centroid(b.target_area::geometry)::geography), ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
         FROM broadcasts b
        WHERE b.status = 'Published'
          AND (b.expires_at IS NULL OR b.expires_at > now())
          AND (
            ST_DWithin(COALESCE(b.target_center, ST_Centroid(b.target_area::geometry)::geography), ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
            OR EXISTS (SELECT 1 FROM broadcast_deliveries bd WHERE bd.broadcast_id = b.id AND bd.user_id = $4::uuid)
          )
        ORDER BY b.published_at DESC NULLS LAST
        LIMIT 50`,
      longitude,
      latitude,
      radiusMeters,
      userId,
    ) as Array<Record<string, unknown>>;
    return { data: rows };
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
