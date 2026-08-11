import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BroadcastAuthorType,
  BroadcastStatus,
  BroadcastType,
  IncidentPriority,
} from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { BroadcastQueueService } from "./broadcast-queue.service";
import { BroadcastLifecycleService, type BroadcastLifecycleEvent } from "./broadcast-lifecycle.service";
import { BroadcastShareService } from "./broadcast-share.service";
import { BroadcastsService, LIVE_BROADCAST_STATUSES } from "./broadcasts.service";
import { buildMissingPersonBroadcastPreview } from "../notifications/citizen-notification-copy";
import {
  BROADCAST_REPORT_REASONS,
  CreateCitizenBroadcastCommentDto,
  CreateMissingPersonBroadcastDto,
  CreateStolenVehicleBroadcastDto,
  maskRegistrationNumber,
  ReportBroadcastDto,
  ResolveBroadcastDto,
  SubmitBroadcastSightingDto,
  validateMissingPersonBroadcastDto,
  validateStolenVehicleBroadcastDto,
  WithdrawBroadcastDto,
} from "./dto/citizen-broadcast.dto";

const DEFAULT_EXPIRY_DAYS = 30;

@Injectable()
export class BroadcastCitizenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly broadcastsService: BroadcastsService,
    private readonly broadcastQueue: BroadcastQueueService,
    private readonly lifecycle: BroadcastLifecycleService,
    private readonly share: BroadcastShareService,
  ) {}

  async createMissingPerson(dto: CreateMissingPersonBroadcastDto, actor: JwtPayload) {
    validateMissingPersonBroadcastDto(dto);
    return this.createCitizenBroadcast(BroadcastType.MissingPerson, dto, actor, {
      title: `Missing person: ${dto.fullName.trim()}`,
      body: this.buildMissingPersonBody(dto),
      metadata: {
        ...dto.metadata,
        fullName: dto.fullName.trim(),
        ageOrApproximateAge: dto.ageOrApproximateAge,
        gender: dto.gender,
        lastSeenAt: dto.lastSeenAt,
        lastSeenLatitude: dto.lastSeenLatitude,
        lastSeenLongitude: dto.lastSeenLongitude,
        lastSeenAddress: dto.lastSeenAddress,
        clothingDescription: dto.clothingDescription,
        physicalDescription: dto.physicalDescription,
        additionalDescription: dto.additionalDescription,
        policeReportReference: dto.policeReportReference,
        reporterRelationship: dto.reporterRelationship,
        medicalVulnerability: dto.medicalVulnerability,
        language: dto.language,
        rewardNotice: dto.rewardNotice,
      },
      latitude: dto.lastSeenLatitude,
      longitude: dto.lastSeenLongitude,
    });
  }

  async createStolenVehicle(dto: CreateStolenVehicleBroadcastDto, actor: JwtPayload) {
    validateStolenVehicleBroadcastDto(dto);
    return this.createCitizenBroadcast(BroadcastType.StolenVehicle, dto, actor, {
      title: `Stolen vehicle: ${dto.make.trim()} ${dto.model.trim()} (${maskRegistrationNumber(dto.registrationNumber)})`,
      body: this.buildStolenVehicleBody(dto),
      metadata: {
        ...dto.metadata,
        vehicleType: dto.vehicleType,
        make: dto.make,
        model: dto.model,
        colour: dto.colour,
        registrationMasked: maskRegistrationNumber(dto.registrationNumber),
        registrationNumber: dto.registrationNumber.trim(),
        stolenAt: dto.stolenAt,
        distinguishingFeatures: dto.distinguishingFeatures,
        policeReportReference: dto.policeReportReference,
        vinLastFour: dto.vinLastFour,
        directionOfTravel: dto.directionOfTravel,
        rewardNotice: dto.rewardNotice,
      },
      latitude: dto.lastKnownLatitude,
      longitude: dto.lastKnownLongitude,
    });
  }

  async listMine(actor: JwtPayload, status?: string) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    const rows = await this.prisma.broadcast.findMany({
      where: {
        creatorUserId: actor.sub,
        deletedAt: null,
        ...(status && status !== "All" ? { status: status as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { comments: true, deliveries: true } } },
    });
    return {
      data: rows.map((row) => ({
        ...this.toPublicBroadcast(row),
        commentsCount: row._count.comments,
        deliveryCount: row._count.deliveries,
        createdAt: row.createdAt,
        updatedAt: row.createdAt,
      })),
    };
  }

  async getShare(id: string) {
    return this.share.getPublicShare(id);
  }

  async resolve(id: string, dto: ResolveBroadcastDto, actor: JwtPayload) {
    const broadcast = await this.getOwnedBroadcast(id, actor);
    if (!LIVE_BROADCAST_STATUSES.has(String(broadcast.status))) {
      throw new BadRequestException("Only active broadcasts can be resolved");
    }
    const updated = await this.prisma.broadcast.update({
      where: { id },
      data: {
        status: BroadcastStatus.Resolved as never,
        resolvedAt: new Date(),
        resolvedByUserId: actor.sub,
      } as never,
    });
    await this.recordAudit(actor, "broadcast.resolved_by_author", id, { note: dto.note });
    await this.lifecycle.enqueueResolutionNotifications(
      id,
      updated.type === BroadcastType.StolenVehicle ? "STOLEN_VEHICLE_RECOVERED" : "MISSING_PERSON_FOUND",
      actor,
    );
    return { data: this.toPublicBroadcast(updated) };
  }

  async withdraw(id: string, dto: WithdrawBroadcastDto, actor: JwtPayload) {
    const broadcast = await this.getOwnedBroadcast(id, actor);
    if (!LIVE_BROADCAST_STATUSES.has(String(broadcast.status))) {
      throw new BadRequestException("Only active broadcasts can be withdrawn");
    }
    const updated = await this.prisma.broadcast.update({
      where: { id },
      data: {
        status: BroadcastStatus.WithdrawnByAuthor as never,
        withdrawnAt: new Date(),
        withdrawnByUserId: actor.sub,
      } as never,
    });
    await this.recordAudit(actor, "broadcast.withdrawn", id, { reason: dto.reason });
    await this.lifecycle.enqueueResolutionNotifications(id, "BROADCAST_WITHDRAWN", actor);
    return { data: this.toPublicBroadcast(updated) };
  }

  async report(id: string, dto: ReportBroadcastDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    if (!dto.reason?.trim()) throw new BadRequestException("Report reason is required");
    if (!BROADCAST_REPORT_REASONS.includes(dto.reason as never)) {
      throw new BadRequestException("Unsupported report reason");
    }
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, deletedAt: null, status: { not: BroadcastStatus.DeletedByAdmin as never } },
    });
    if (!broadcast) throw new NotFoundException("Broadcast not found");
    const existing = await this.prisma.broadcastReport.findFirst({
      where: { broadcastId: id, reporterUserId: actor.sub, reason: dto.reason.trim(), status: "Open" },
    });
    if (existing) return { data: { id: existing.id, status: existing.status, duplicate: true } };
    const report = await this.prisma.broadcastReport.create({
      data: {
        broadcastId: id,
        reporterUserId: actor.sub,
        reason: dto.reason.trim(),
        details: dto.details?.trim(),
      } as never,
    });
    await this.recordAudit(actor, "broadcast.reported", id, { reportId: report.id, reason: dto.reason });
    return { data: { id: report.id, status: report.status } };
  }

  async addComment(id: string, dto: CreateCitizenBroadcastCommentDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    if (!dto.body?.trim()) throw new BadRequestException("Comment body is required");
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, deletedAt: null, commentsLocked: false },
    });
    if (!broadcast || !LIVE_BROADCAST_STATUSES.has(String(broadcast.status))) {
      throw new NotFoundException("Broadcast not available for comments");
    }
    const comment = await this.prisma.broadcastComment.create({
      data: {
        broadcastId: id,
        authorUserId: actor.sub,
        body: dto.body.trim(),
        parentId: dto.parentId,
        metadata: dto.isSighting ? { isSighting: true } : {},
      } as never,
    });
    await this.recordAudit(actor, "broadcast.comment_added", id, { commentId: comment.id });
    return { data: comment };
  }

  async listComments(id: string) {
    const comments = await this.prisma.broadcastComment.findMany({
      where: { broadcastId: id, hiddenAt: null },
      orderBy: [{ isPinned: "desc" }, { createdAt: "asc" }],
      take: 100,
    });
    return { data: comments.map((comment) => this.toPublicComment(comment)) };
  }

  async submitSighting(id: string, dto: SubmitBroadcastSightingDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    if (!dto.description?.trim()) throw new BadRequestException("Sighting description is required");
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, deletedAt: null, commentsLocked: false },
    });
    if (!broadcast || !LIVE_BROADCAST_STATUSES.has(String(broadcast.status))) {
      throw new NotFoundException("Broadcast not available for sightings");
    }
    if (dto.clientSightingId) {
      const existing = await this.prisma.broadcastSighting.findFirst({
        where: { broadcastId: id, reporterUserId: actor.sub, metadata: { path: ["clientSightingId"], equals: dto.clientSightingId } },
      });
      if (existing) return { data: existing, duplicate: true };
    }
    const sighting = await this.prisma.broadcastSighting.create({
      data: {
        broadcastId: id,
        reporterUserId: actor.sub,
        observedAt: dto.observedAt ? new Date(dto.observedAt) : new Date(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        approximateArea: dto.approximateArea?.trim(),
        description: dto.description.trim(),
        confidence: dto.confidence,
        anonymousPublic: dto.anonymousPublic === true,
        directionOfTravel: dto.directionOfTravel,
        metadata: dto.clientSightingId ? { clientSightingId: dto.clientSightingId } : {},
      } as never,
    });
    await this.recordAudit(actor, "broadcast.sighting_submitted", id, { sightingId: sighting.id });
    return { data: { id: sighting.id, status: "Received" } };
  }

  private toPublicComment(comment: Record<string, unknown>) {
    const isOfficial = comment.isOfficial === true;
    const metadata = (comment.metadata as Record<string, unknown> | null) ?? {};
    const label = isOfficial
      ? "Official Admin Update"
      : metadata.isSighting === true
        ? "Verified Sighting"
        : "User Comment";
    return {
      id: comment.id,
      body: comment.body,
      label,
      isOfficial,
      isPinned: comment.isPinned === true,
      createdAt: comment.createdAt,
    };
  }

  private async createCitizenBroadcast(
    type: BroadcastType,
    dto: CreateMissingPersonBroadcastDto | CreateStolenVehicleBroadcastDto,
    actor: JwtPayload,
    payload: {
      title: string;
      body: string;
      metadata: Record<string, unknown>;
      latitude?: number;
      longitude?: number;
    },
  ) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");

    const existing = await this.prisma.broadcast.findFirst({
      where: { creatorUserId: actor.sub, clientBroadcastId: dto.clientBroadcastId },
    });
    if (existing) {
      return { data: this.toPublicBroadcast(existing), duplicate: true };
    }

    const profile = await this.prisma.profile.findUnique({ where: { userId: actor.sub } });
    if (!profile) throw new BadRequestException("Complete your profile before creating broadcasts");

    const country = dto.country?.trim() || profile.country;
    if (dto.country && dto.country.trim() !== profile.country) {
      throw new ForbiddenException("Citizens may only publish broadcasts within their registered country");
    }

    const duplicateWarning = await this.findDuplicateWarning(type, dto, actor.sub);
    const jurisdictionId = await this.resolveJurisdictionId(country, dto.state ?? profile.state, dto.lga ?? profile.lga, payload.latitude, payload.longitude);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const broadcast = await this.prisma.broadcast.create({
      data: {
        type: type as never,
        title: payload.title,
        body: payload.body,
        priority: IncidentPriority.P2ActiveCrimeAccident as never,
        status: BroadcastStatus.Active as never,
        requiresApproval: false,
        autoPublished: true,
        authorType: BroadcastAuthorType.Citizen as never,
        creatorUserId: actor.sub,
        country,
        state: dto.state ?? profile.state,
        lga: dto.lga ?? profile.lga,
        jurisdictionId,
        metadata: {
          ...payload.metadata,
          contactMethod: "in_app",
          consentDeclaration: "accepted",
          duplicateWarning,
        },
        clientBroadcastId: dto.clientBroadcastId,
        publishedAt: now,
        expiresAt,
        duplicateOfId: duplicateWarning?.existingBroadcastId,
      } as never,
    });

    if (payload.latitude !== undefined && payload.longitude !== undefined) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE broadcasts SET target_center = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         target_area = ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 5000)::geometry)::geography
         WHERE id = $3::uuid`,
        payload.longitude,
        payload.latitude,
        broadcast.id,
      );
    } else if (jurisdictionId) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE broadcasts b SET target_area = j.boundary FROM jurisdictions j WHERE b.id = $1::uuid AND j.id = $2::uuid`,
        broadcast.id,
        jurisdictionId,
      );
    }

    await this.recordAudit(actor, "broadcast.citizen_created", broadcast.id, {
      type,
      country,
      duplicateWarning,
    });

    await this.broadcastQueue.enqueueCountryDelivery(broadcast.id, country, 0);

    return {
      data: this.toPublicBroadcast(broadcast),
      duplicateWarning,
    };
  }

  private async getOwnedBroadcast(id: string, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, creatorUserId: actor.sub, deletedAt: null },
    });
    if (!broadcast) throw new NotFoundException("Broadcast not found");
    return broadcast;
  }

  private async findDuplicateWarning(
    type: BroadcastType,
    dto: CreateMissingPersonBroadcastDto | CreateStolenVehicleBroadcastDto,
    userId: string,
  ) {
    if (type === BroadcastType.MissingPerson) {
      const missing = dto as CreateMissingPersonBroadcastDto;
      const existing = await this.prisma.broadcast.findFirst({
        where: {
          type: BroadcastType.MissingPerson as never,
          status: { in: [BroadcastStatus.Active, BroadcastStatus.Published, BroadcastStatus.Updated] as never[] },
          creatorUserId: userId,
          metadata: { path: ["fullName"], equals: missing.fullName.trim() },
        },
      });
      if (existing) {
        return { existingBroadcastId: existing.id, message: "A similar missing person broadcast is already active." };
      }
    }
    if (type === BroadcastType.StolenVehicle) {
      const stolen = dto as CreateStolenVehicleBroadcastDto;
      const existing = await this.prisma.broadcast.findFirst({
        where: {
          type: BroadcastType.StolenVehicle as never,
          status: { in: [BroadcastStatus.Active, BroadcastStatus.Published, BroadcastStatus.Updated] as never[] },
          metadata: { path: ["registrationNumber"], equals: stolen.registrationNumber.trim() },
        },
      });
      if (existing) {
        return { existingBroadcastId: existing.id, message: "A broadcast for this registration may already exist." };
      }
    }
    return null;
  }

  private async resolveJurisdictionId(
    country: string,
    state: string,
    lga: string,
    latitude?: number,
    longitude?: number,
  ) {
    if (latitude !== undefined && longitude !== undefined) {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM jurisdictions WHERE ST_Contains(boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326)) LIMIT 1`,
        longitude,
        latitude,
      );
      if (rows[0]?.id) return rows[0].id;
    }
    const jurisdiction = await this.prisma.jurisdiction.findFirst({
      where: { country, state, lga },
      select: { id: true },
    });
    return jurisdiction?.id;
  }

  private buildMissingPersonBody(dto: CreateMissingPersonBroadcastDto) {
    return buildMissingPersonBroadcastPreview({
      fullName: dto.fullName,
      ageOrApproximateAge: dto.ageOrApproximateAge,
      lastSeenAt: dto.lastSeenAt,
    });
  }

  private formatCitizenDateTimeLabel(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  private buildStolenVehicleBody(dto: CreateStolenVehicleBroadcastDto) {
    return [
      `${dto.colour} ${dto.make} ${dto.model} (${maskRegistrationNumber(dto.registrationNumber)}) reported stolen ${dto.stolenAt}.`,
      dto.distinguishingFeatures.trim(),
      dto.lastKnownLocation?.trim(),
    ]
      .filter(Boolean)
      .join(" ");
  }

  private toPublicBroadcast(broadcast: Record<string, unknown>) {
    const authorType = String(broadcast.authorType ?? "Admin");
    const adminVerified = broadcast.adminVerified === true;
    return {
      id: broadcast.id,
      type: broadcast.type,
      title: broadcast.title,
      body: broadcast.body,
      status: broadcast.status,
      country: broadcast.country,
      state: broadcast.state,
      lga: broadcast.lga,
      publishedAt: broadcast.publishedAt,
      expiresAt: broadcast.expiresAt,
      metadata: broadcast.metadata,
      authorLabel:
        authorType === "Citizen"
          ? adminVerified
            ? "Verified by Admin"
            : "Citizen Broadcast"
          : adminVerified
            ? "Verified by Admin"
            : "Admin Broadcast",
      adminVerified,
      deepLink: `/broadcasts/${broadcast.id}`,
    };
  }

  private recordAudit(actor: JwtPayload, action: string, entityId: string, metadata: Record<string, unknown>) {
    return this.audit.record({ actor, action, entityType: "broadcasts", entityId, metadata });
  }
}
