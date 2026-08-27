import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AdminRoleName,
  BroadcastAuthorType,
  BroadcastStatus,
  BroadcastType,
} from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { createStorageDownloadUrl } from "../../common/storage/s3-presign";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { BroadcastLifecycleService } from "./broadcast-lifecycle.service";
import { BroadcastQueueService } from "./broadcast-queue.service";
import { BroadcastsService, LIVE_BROADCAST_STATUSES } from "./broadcasts.service";
import { CreateBroadcastDto, validateCreateBroadcastDto } from "./dto/broadcast.dto";

export type AdminBroadcastListQuery = {
  country?: string;
  state?: string;
  category?: string;
  status?: string;
  author?: string;
  cursor?: string;
  limit?: string;
};

export type AdminBroadcastCommentDto = {
  body: string;
  pin?: boolean;
};

export type AdminModerationReasonDto = {
  reason?: string;
  note?: string;
};

@Injectable()
export class BroadcastAdminService {
  private readonly signDownloadUrl = createStorageDownloadUrl;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly broadcastsService: BroadcastsService,
    private readonly broadcastQueue: BroadcastQueueService,
    private readonly lifecycle: BroadcastLifecycleService,
  ) {}

  async list(actor: JwtPayload, query: AdminBroadcastListQuery = {}) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin access required");
    const limit = Math.min(Number(query.limit ?? 25) || 25, 100);
    const where = {
      deletedAt: null,
      ...this.jurisdictionWhere(actor),
      ...(query.country ? { country: query.country } : {}),
      ...(query.state ? { state: query.state } : {}),
      ...(query.category ? { type: query.category as never } : {}),
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.author === "Citizen" ? { authorType: BroadcastAuthorType.Citizen as never } : {}),
      ...(query.author === "Admin" ? { authorType: BroadcastAuthorType.Admin as never } : {}),
    };
    const rows = await this.prisma.broadcast.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      include: {
        _count: { select: { comments: true, reports: true, deliveries: true, sightings: true } },
      },
    });
    return { data: rows };
  }

  async getDetail(id: string, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin access required");
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, deletedAt: null, ...this.jurisdictionWhere(actor) },
      include: {
        creator: { select: { displayName: true } },
        creatorUser: { select: { profile: { select: { firstName: true, lastName: true } } } },
        media: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            mediaType: true,
            role: true,
            contentType: true,
            durationSeconds: true,
          },
        },
        sightings: { orderBy: { createdAt: "desc" } },
        deliveries: { select: { id: true } },
        _count: { select: { comments: true, reports: true, deliveries: true, sightings: true } },
      },
    });
    if (!broadcast) throw new NotFoundException("Broadcast not found");
    return { data: broadcast };
  }

  async viewMedia(id: string, mediaId: string, actor: JwtPayload) {
    await this.getScoped(id, actor);
    const media = await this.prisma.broadcastMedia.findFirst({
      where: { id: mediaId, broadcastId: id, deletedAt: null },
    });
    if (!media) throw new NotFoundException("Broadcast evidence not found");
    const signed = await this.signDownloadUrl(media.objectKey, 300);
    await this.audit.record({
      actor,
      action: "broadcast.evidence_viewed",
      entityType: "broadcast_media",
      entityId: media.id,
      metadata: { broadcastId: id, mediaType: media.mediaType },
    });
    return {
      data: {
        id: media.id,
        mediaType: media.mediaType,
        contentType: media.contentType,
        durationSeconds: media.durationSeconds,
      },
      signedUrl: signed.url,
      expiresInSeconds: signed.expiresInSeconds,
    };
  }

  async create(dto: CreateBroadcastDto & { country?: string; state?: string; lga?: string }, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin access required");
    this.assertCountryScope(actor, dto.country ?? actor.country);
    validateCreateBroadcastDto(dto);
    this.assertAdminCategory(dto.type);

    const jurisdictionId = dto.jurisdictionId ?? (await this.inferJurisdictionId(dto));
    const country = dto.country ?? actor.country;
    const now = new Date();
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
        status: BroadcastStatus.Active as never,
        requiresApproval: false,
        autoPublished: false,
        country,
        state: dto.state ?? actor.state,
        lga: dto.lga ?? actor.lga,
        targetRadiusMeters: dto.radiusMeters,
        publishedAt: now,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      } as never,
    });

    await this.writeGeofence(broadcast.id, dto, jurisdictionId);
    await this.recordAudit(actor, "broadcast.admin_created", broadcast.id, { type: dto.type, country });

    if (country) {
      await this.broadcastQueue.enqueueCountryDelivery(broadcast.id, country, 0);
    } else {
      await this.broadcastsService.dispatch(
        broadcast.id,
        { typ: "admin", sub: actor.sub, permissions: ["broadcast:publish"] } as JwtPayload,
        "broadcast.admin_dispatched",
      );
    }

    return { data: await this.prisma.broadcast.findUnique({ where: { id: broadcast.id } }) };
  }

  async patch(id: string, dto: Partial<CreateBroadcastDto>, actor: JwtPayload) {
    const broadcast = await this.getScoped(id, actor);
    if (!LIVE_BROADCAST_STATUSES.has(String(broadcast.status)) && broadcast.status !== BroadcastStatus.Suspended) {
      throw new BadRequestException("Broadcast cannot be edited in its current state");
    }
    const updated = await this.prisma.broadcast.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.body ? { body: dto.body.trim() } : {}),
        ...(dto.priority ? { priority: dto.priority as never } : {}),
        status: BroadcastStatus.Updated as never,
      } as never,
    });
    await this.recordAudit(actor, "broadcast.admin_updated", id, { fields: Object.keys(dto) });
    return { data: updated };
  }

  async suspend(id: string, actor: JwtPayload, dto: AdminModerationReasonDto) {
    if (!this.canModerate(actor)) throw new ForbiddenException("Moderator access required");
    const broadcast = await this.getScoped(id, actor);
    const updated = await this.prisma.broadcast.update({
      where: { id },
      data: {
        status: BroadcastStatus.Suspended as never,
        suspendedAt: new Date(),
        suspendedReason: dto.reason?.trim() ?? "Suspended by administrator",
        suspendedByAdminId: actor.sub,
      } as never,
    });
    await this.recordAudit(actor, "broadcast.suspended", id, { reason: dto.reason, priorStatus: broadcast.status });
    await this.lifecycle.enqueueResolutionNotifications(id, "BROADCAST_SUSPENDED", actor);
    return { data: updated };
  }

  async restore(id: string, actor: JwtPayload) {
    if (!this.canModerate(actor)) throw new ForbiddenException("Moderator access required");
    const broadcast = await this.getScoped(id, actor);
    if (broadcast.status !== BroadcastStatus.Suspended) {
      throw new BadRequestException("Only suspended broadcasts can be restored");
    }
    const updated = await this.prisma.broadcast.update({
      where: { id },
      data: {
        status: BroadcastStatus.Active as never,
        suspendedAt: null,
        suspendedReason: null,
        suspendedByAdminId: null,
      } as never,
    });
    await this.recordAudit(actor, "broadcast.restored", id, { priorStatus: broadcast.status });
    await this.lifecycle.enqueueResolutionNotifications(id, "BROADCAST_RESTORED", actor);
    return { data: updated };
  }

  async softDelete(id: string, actor: JwtPayload, dto: AdminModerationReasonDto) {
    if (!this.canModerate(actor)) throw new ForbiddenException("Moderator access required");
    await this.getScoped(id, actor);
    const updated = await this.prisma.broadcast.update({
      where: { id },
      data: {
        status: BroadcastStatus.DeletedByAdmin as never,
        deletedAt: new Date(),
        deletedByAdminId: actor.sub,
      } as never,
    });
    await this.recordAudit(actor, "broadcast.deleted_by_admin", id, { reason: dto.reason });
    return { data: updated };
  }

  async verify(id: string, actor: JwtPayload, dto: AdminModerationReasonDto) {
    if (!this.canModerate(actor)) throw new ForbiddenException("Moderator access required");
    await this.getScoped(id, actor);
    const updated = await this.prisma.broadcast.update({
      where: { id },
      data: {
        adminVerified: true,
        verifiedAt: new Date(),
        verifiedByAdminId: actor.sub,
      } as never,
    });
    await this.recordAudit(actor, "broadcast.verified", id, { note: dto.note });
    return { data: updated };
  }

  async resolve(id: string, actor: JwtPayload, dto: AdminModerationReasonDto) {
    if (!this.canModerate(actor)) throw new ForbiddenException("Moderator access required");
    const broadcast = await this.getScoped(id, actor);
    const updated = await this.prisma.broadcast.update({
      where: { id },
      data: {
        status: BroadcastStatus.Resolved as never,
        resolvedAt: new Date(),
        resolvedByAdminId: actor.sub,
      } as never,
    });
    await this.recordAudit(actor, "broadcast.resolved_by_admin", id, {
      note: dto.note,
      priorStatus: broadcast.status,
    });
    const eventType =
      broadcast.type === BroadcastType.MissingPerson
        ? "MISSING_PERSON_FOUND"
        : broadcast.type === BroadcastType.StolenVehicle
          ? "STOLEN_VEHICLE_RECOVERED"
          : "BROADCAST_OFFICIAL_UPDATE";
    await this.lifecycle.enqueueResolutionNotifications(id, eventType, actor);
    return { data: updated };
  }

  async addOfficialComment(id: string, actor: JwtPayload, dto: AdminBroadcastCommentDto) {
    if (!this.canModerate(actor)) throw new ForbiddenException("Moderator access required");
    await this.getScoped(id, actor);
    if (!dto.body?.trim()) throw new BadRequestException("Comment body is required");
    const comment = await this.prisma.broadcastComment.create({
      data: {
        broadcastId: id,
        authorAdminId: actor.sub,
        body: dto.body.trim(),
        isOfficial: true,
        isPinned: dto.pin === true,
      } as never,
    });
    await this.recordAudit(actor, "broadcast.admin_comment", id, { commentId: comment.id, pinned: dto.pin === true });
    await this.lifecycle.enqueueResolutionNotifications(id, "BROADCAST_OFFICIAL_UPDATE", actor);
    return { data: comment };
  }

  async listReports(id: string, actor: JwtPayload) {
    await this.getScoped(id, actor);
    const reports = await this.prisma.broadcastReport.findMany({
      where: { broadcastId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { data: reports };
  }

  private canModerate(actor: JwtPayload) {
    if (actor.typ !== "admin") return false;
    const permissions = new Set(actor.permissions ?? []);
    return permissions.has("broadcast:publish") || permissions.has("broadcast:approve") || permissions.has("community:moderate");
  }

  private assertAdminCategory(type: BroadcastType) {
    const allowed = new Set<BroadcastType>([
      BroadcastType.Emergency,
      BroadcastType.Crime,
      BroadcastType.Accident,
      BroadcastType.MissingPerson,
      BroadcastType.StolenVehicle,
      BroadcastType.GovernmentAlert,
      BroadcastType.CommunityWarning,
    ]);
    if (!allowed.has(type)) throw new BadRequestException("Unsupported admin broadcast category");
  }

  private assertCountryScope(actor: JwtPayload, country?: string | null) {
    if (actor.role === "Super Admin") return;
    if (!country || country !== actor.country) {
      throw new ForbiddenException("Broadcast country is outside your jurisdiction");
    }
  }

  private jurisdictionWhere(actor: JwtPayload) {
    if (actor.role === AdminRoleName.SuperAdmin) return {};
    const country = actor.country ?? "__no_country__";
    if (actor.role === AdminRoleName.CountryAdmin) {
      return { OR: [{ country }, { jurisdiction: { country } }] } as never;
    }
    if (actor.role === AdminRoleName.StateAdmin) {
      return {
        OR: [
          { country, state: actor.state ?? "__no_state__" },
          { jurisdiction: { country, state: actor.state ?? "__no_state__" } },
        ],
      } as never;
    }
    if (
      actor.role === AdminRoleName.LgaAdmin
      || actor.role === AdminRoleName.CallCenterAgent
      || actor.role === AdminRoleName.OversightAuditor
    ) {
      return {
        OR: [
          { country, state: actor.state ?? "__no_state__", lga: actor.lga ?? "__no_lga__" },
          { jurisdiction: { country, state: actor.state ?? "__no_state__", lga: actor.lga ?? "__no_lga__" } },
        ],
      } as never;
    }
    if (actor.role === AdminRoleName.AgencyAdmin || actor.role === AdminRoleName.PoliceSecurityOfficer) {
      return { incident: { assignedAgencyId: actor.agencyId ?? "__no_agency__" } } as never;
    }
    return { id: "__deny_all__" } as never;
  }

  private async getScoped(id: string, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin access required");
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, deletedAt: null, ...this.jurisdictionWhere(actor) },
    });
    if (!broadcast) throw new NotFoundException("Broadcast not found");
    return broadcast;
  }

  private async inferJurisdictionId(dto: CreateBroadcastDto) {
    if (dto.incidentId) {
      const incident = await this.prisma.incident.findUnique({ where: { id: dto.incidentId } });
      return incident?.jurisdictionId;
    }
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM jurisdictions WHERE ST_Contains(boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326)) LIMIT 1`,
        dto.longitude,
        dto.latitude,
      );
      return rows[0]?.id;
    }
    return dto.jurisdictionId;
  }

  private async writeGeofence(id: string, dto: CreateBroadcastDto, jurisdictionId?: string | null) {
    if (dto.targetAreaWkt) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE broadcasts SET target_area = ST_Multi(ST_GeomFromText($1, 4326))::geography WHERE id = $2::uuid`,
        dto.targetAreaWkt,
        id,
      );
      return;
    }
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      const radius = dto.radiusMeters ?? 5000;
      await this.prisma.$executeRawUnsafe(
        `UPDATE broadcasts SET target_center = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         target_area = ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)::geometry)::geography
         WHERE id = $4::uuid`,
        dto.longitude,
        dto.latitude,
        radius,
        id,
      );
      return;
    }
    if (jurisdictionId) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE broadcasts b SET target_area = j.boundary FROM jurisdictions j WHERE b.id = $1::uuid AND j.id = $2::uuid`,
        id,
        jurisdictionId,
      );
    }
  }

  private recordAudit(actor: JwtPayload, action: string, entityId: string, metadata: Record<string, unknown>) {
    return this.audit.record({ actor, action, entityType: "broadcasts", entityId, metadata });
  }
}
