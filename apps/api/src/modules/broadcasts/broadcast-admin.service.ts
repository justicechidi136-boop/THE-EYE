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
  lga?: string;
  communityId?: string;
  category?: string;
  status?: string;
  author?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
};

type ResolvedBroadcastTarget = {
  level: "Country" | "State" | "LGA" | "Community";
  country: string;
  state?: string;
  lga?: string;
  jurisdictionId?: string;
  communityId?: string;
  label: string;
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
    const page = Math.max(Number(query.page ?? 1) || 1, 1);
    const createdAt = this.createdAtFilter(query.from, query.to);
    const search = query.search?.trim();
    const where: any = {
      deletedAt: null,
      ...this.jurisdictionWhere(actor),
      ...(query.country ? { country: query.country } : {}),
      ...(query.state ? { state: query.state } : {}),
      ...(query.lga ? { lga: query.lga } : {}),
      ...(query.communityId
        ? { metadata: { path: ["target", "communityId"], equals: query.communityId } }
        : {}),
      ...(query.category ? { type: query.category as never } : {}),
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.author === "Citizen" ? { authorType: BroadcastAuthorType.Citizen as never } : {}),
      ...(query.author === "Admin" ? { authorType: BroadcastAuthorType.Admin as never } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(search
        ? {
            AND: [{
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { body: { contains: search, mode: "insensitive" } },
                { country: { contains: search, mode: "insensitive" } },
                { state: { contains: search, mode: "insensitive" } },
                { lga: { contains: search, mode: "insensitive" } },
                { creator: { displayName: { contains: search, mode: "insensitive" } } },
                { creatorUser: { profile: { firstName: { contains: search, mode: "insensitive" } } } },
                { creatorUser: { profile: { lastName: { contains: search, mode: "insensitive" } } } },
              ],
            }],
          }
        : {}),
    };
    const lifecycleScope = { deletedAt: null, ...this.jurisdictionWhere(actor) };
    const now = new Date();
    const [rows, total, published, active, expired, cancelled] = await Promise.all([
      this.prisma.broadcast.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          creator: { select: { displayName: true } },
          creatorUser: { select: { profile: { select: { firstName: true, lastName: true } } } },
          approver: { select: { displayName: true } },
          verifiedBy: { select: { displayName: true } },
          _count: { select: { comments: true, reports: true, deliveries: true, sightings: true } },
        },
      }),
      this.prisma.broadcast.count({ where }),
      this.prisma.broadcast.count({ where: { ...lifecycleScope, status: BroadcastStatus.Published as never } }),
      this.prisma.broadcast.count({
        where: {
          ...lifecycleScope,
          status: { in: [BroadcastStatus.Active, BroadcastStatus.Updated] as never },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      this.prisma.broadcast.count({
        where: {
          ...lifecycleScope,
          OR: [
            { status: BroadcastStatus.Expired as never },
            {
              status: { in: [BroadcastStatus.Published, BroadcastStatus.Active, BroadcastStatus.Updated] as never },
              expiresAt: { lte: now },
            },
          ],
        },
      }),
      this.prisma.broadcast.count({
        where: {
          ...lifecycleScope,
          status: {
            in: [
              BroadcastStatus.Cancelled,
              BroadcastStatus.WithdrawnByAuthor,
              BroadcastStatus.DeletedByAdmin,
            ] as never,
          },
        },
      }),
    ]);
    return {
      data: rows,
      pagination: { page, limit, total, pageCount: Math.max(1, Math.ceil(total / limit)) },
      meta: { published, active, expired, cancelled },
    };
  }

  async targetOptions(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin access required");
    const [jurisdictions, communities] = await Promise.all([
      this.prisma.jurisdiction.findMany({
        where: {
          ...this.jurisdictionRecordWhere(actor),
          NOT: [{ state: "All" }, { lga: "All" }],
        },
        orderBy: [{ country: "asc" }, { state: "asc" }, { lga: "asc" }],
        select: { id: true, country: true, state: true, lga: true, name: true },
      }),
      this.prisma.community.findMany({
        where: { ...this.communityRecordWhere(actor), status: "Active" as never },
        orderBy: [{ country: "asc" }, { state: "asc" }, { lga: "asc" }, { name: "asc" }],
        select: {
          id: true,
          jurisdictionId: true,
          name: true,
          level: true,
          country: true,
          state: true,
          lga: true,
        },
      }),
    ]);
    return { data: { jurisdictions, communities } };
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
        sightings: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            observedAt: true,
            latitude: true,
            longitude: true,
            approximateArea: true,
            description: true,
            confidence: true,
            anonymousPublic: true,
            directionOfTravel: true,
            metadata: true,
            createdAt: true,
            reporter: { select: { profile: { select: { firstName: true, lastName: true } } } },
            media: {
              where: { deletedAt: null },
              orderBy: { createdAt: "asc" },
              select: { id: true, mediaType: true, role: true, contentType: true },
            },
          },
        },
        deliveries: { select: { id: true, status: true, channel: true, sentAt: true, readAt: true } },
        _count: { select: { comments: true, reports: true, deliveries: true, sightings: true } },
      },
    });
    if (!broadcast) throw new NotFoundException("Broadcast not found");
    const targetRows = await this.prisma.$queryRawUnsafe<Array<{ latitude: number | null; longitude: number | null }>>(
      `SELECT ST_Y(target_center::geometry) AS latitude,
              ST_X(target_center::geometry) AS longitude
         FROM broadcasts
        WHERE id = $1::uuid`,
      id,
    );
    return {
      data: {
        ...broadcast,
        targetLatitude: targetRows[0]?.latitude ?? null,
        targetLongitude: targetRows[0]?.longitude ?? null,
      },
    };
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

  async create(dto: CreateBroadcastDto, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin access required");
    this.assertCountryScope(actor, dto.country ?? actor.country);
    validateCreateBroadcastDto(dto);
    this.assertAdminCategory(dto.type);

    const target = await this.resolveTarget(dto, actor);
    const jurisdictionId = target.jurisdictionId ?? (await this.inferJurisdictionId(dto));
    const country = target.country;
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
        state: target.state,
        lga: target.lga,
        targetRadiusMeters: dto.deliveryMode === "Radius" ? dto.radiusMeters : null,
        metadata: {
          target: {
            level: target.level,
            label: target.label,
            jurisdictionId: target.jurisdictionId,
            communityId: target.communityId,
            deliveryMode: dto.deliveryMode ?? "EntireArea",
          },
        },
        publishedAt: now,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      } as never,
    });

    await this.writeGeofence(broadcast.id, dto, target);
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
      BroadcastType.SafetyAlert,
      BroadcastType.GovernmentAlert,
      BroadcastType.CommunityWarning,
      BroadcastType.PublicAdvisory,
      BroadcastType.EmergencyWarning,
    ]);
    if (!allowed.has(type)) throw new BadRequestException("Unsupported admin broadcast category");
  }

  private assertCountryScope(actor: JwtPayload, country?: string | null) {
    if (actor.role === "Super Admin") return;
    if (!country || country !== actor.country) {
      throw new ForbiddenException("Broadcast country is outside your jurisdiction");
    }
  }

  private createdAtFilter(from?: string, to?: string) {
    if (!from && !to) return undefined;
    const start = from ? new Date(from) : undefined;
    const end = to ? new Date(to) : undefined;
    if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
      throw new BadRequestException("Invalid broadcast date range");
    }
    if (start && end && start > end) throw new BadRequestException("Broadcast date range is reversed");
    return { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) };
  }

  private jurisdictionRecordWhere(actor: JwtPayload) {
    if (actor.role === AdminRoleName.SuperAdmin) return {};
    if (actor.role === AdminRoleName.CountryAdmin) return { country: actor.country ?? "__no_country__" };
    if (actor.role === AdminRoleName.StateAdmin) {
      return { country: actor.country ?? "__no_country__", state: actor.state ?? "__no_state__" };
    }
    if (actor.role === AdminRoleName.LgaAdmin) {
      return {
        country: actor.country ?? "__no_country__",
        state: actor.state ?? "__no_state__",
        lga: actor.lga ?? "__no_lga__",
      };
    }
    return { id: "__deny_all__" };
  }

  private communityRecordWhere(actor: JwtPayload) {
    const where = this.jurisdictionRecordWhere(actor) as Record<string, string>;
    if (where.id) return where;
    return {
      ...(where.country ? { country: where.country } : {}),
      ...(where.state ? { state: where.state } : {}),
      ...(where.lga ? { lga: where.lga } : {}),
    };
  }

  private async resolveTarget(dto: CreateBroadcastDto, actor: JwtPayload): Promise<ResolvedBroadcastTarget> {
    const level = dto.targetLevel ?? (dto.communityId ? "Community" : dto.jurisdictionId ? "LGA" : dto.state ? "State" : "Country");
    if (level === "Community") {
      if (!dto.communityId) throw new BadRequestException("Select a community target");
      const community = await this.prisma.community.findFirst({
        where: { id: dto.communityId, ...this.communityRecordWhere(actor), status: "Active" as never },
        select: { id: true, jurisdictionId: true, name: true, country: true, state: true, lga: true },
      });
      if (!community) throw new ForbiddenException("Community is outside your jurisdiction");
      return {
        level,
        country: community.country,
        state: community.state ?? undefined,
        lga: community.lga ?? undefined,
        jurisdictionId: community.jurisdictionId ?? undefined,
        communityId: community.id,
        label: community.name,
      };
    }
    if (level === "LGA") {
      if (!dto.jurisdictionId) throw new BadRequestException("Select a City / LGA target");
      const jurisdiction = await this.prisma.jurisdiction.findFirst({
        where: { id: dto.jurisdictionId, ...this.jurisdictionRecordWhere(actor) },
      });
      if (!jurisdiction) throw new ForbiddenException("City / LGA is outside your jurisdiction");
      return {
        level,
        country: jurisdiction.country,
        state: jurisdiction.state,
        lga: jurisdiction.lga,
        jurisdictionId: jurisdiction.id,
        label: jurisdiction.name || jurisdiction.lga,
      };
    }
    const where = {
      ...this.jurisdictionRecordWhere(actor),
      ...(dto.country ? { country: dto.country } : {}),
      ...(level === "State" && dto.state ? { state: dto.state } : {}),
    };
    const canonical = await this.prisma.jurisdiction.findFirst({ where });
    if (!canonical) throw new ForbiddenException("Target area is outside your jurisdiction");
    return {
      level,
      country: canonical.country,
      state: level === "State" ? canonical.state : undefined,
      label: level === "State" ? canonical.state : canonical.country,
    };
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

  private async writeGeofence(id: string, dto: CreateBroadcastDto, target: ResolvedBroadcastTarget) {
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
    const radius = dto.deliveryMode === "Radius" ? dto.radiusMeters ?? 5000 : null;
    if (target.communityId) {
      await this.prisma.$executeRawUnsafe(
        radius
          ? `UPDATE broadcasts b SET target_area = ST_Multi(ST_Buffer(COALESCE(c.center, ST_Centroid(c.boundary::geometry)::geography), $1)::geometry)::geography,
             target_center = COALESCE(c.center, ST_Centroid(c.boundary::geometry)::geography)
             FROM communities c WHERE b.id = $2::uuid AND c.id = $3::uuid`
          : `UPDATE broadcasts b SET target_area = c.boundary,
             target_center = COALESCE(c.center, ST_Centroid(c.boundary::geometry)::geography)
             FROM communities c WHERE b.id = $1::uuid AND c.id = $2::uuid`,
        ...(radius ? [radius, id, target.communityId] : [id, target.communityId]),
      );
      return;
    }
    if (target.jurisdictionId) {
      await this.prisma.$executeRawUnsafe(
        radius
          ? `UPDATE broadcasts b SET target_area = ST_Multi(ST_Buffer(ST_Centroid(j.boundary::geometry)::geography, $1)::geometry)::geography,
             target_center = ST_Centroid(j.boundary::geometry)::geography
             FROM jurisdictions j WHERE b.id = $2::uuid AND j.id = $3::uuid`
          : `UPDATE broadcasts b SET target_area = j.boundary,
             target_center = ST_Centroid(j.boundary::geometry)::geography
             FROM jurisdictions j WHERE b.id = $1::uuid AND j.id = $2::uuid`,
        ...(radius ? [radius, id, target.jurisdictionId] : [id, target.jurisdictionId]),
      );
      return;
    }
    await this.prisma.$executeRawUnsafe(
      radius
        ? `UPDATE broadcasts b SET target_area = source.area, target_center = source.center
           FROM (
             SELECT ST_Multi(ST_Buffer(ST_Centroid(ST_Union(boundary::geometry))::geography, $1)::geometry)::geography AS area,
                    ST_Centroid(ST_Union(boundary::geometry))::geography AS center
             FROM jurisdictions WHERE country = $2 AND ($3::text IS NULL OR state = $3)
           ) source WHERE b.id = $4::uuid`
        : `UPDATE broadcasts b SET target_area = source.area, target_center = source.center
           FROM (
             SELECT ST_Multi(ST_Union(boundary::geometry))::geography AS area,
                    ST_Centroid(ST_Union(boundary::geometry))::geography AS center
             FROM jurisdictions WHERE country = $1 AND ($2::text IS NULL OR state = $2)
           ) source WHERE b.id = $3::uuid`,
      ...(radius ? [radius, target.country, target.state ?? null, id] : [target.country, target.state ?? null, id]),
    );
  }

  private recordAudit(actor: JwtPayload, action: string, entityId: string, metadata: Record<string, unknown>) {
    return this.audit.record({ actor, action, entityType: "broadcasts", entityId, metadata });
  }
}
