import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  BroadcastAuthorType,
  BroadcastStatus,
  BroadcastType,
  IncidentPriority,
} from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import {
  createStorageDownloadUrl,
  createStorageUploadUrl,
  evidenceObjectKey,
  validateEvidenceUpload,
} from "../../common/storage/s3-presign";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { BroadcastQueueService } from "./broadcast-queue.service";
import { BroadcastLifecycleService } from "./broadcast-lifecycle.service";
import { BroadcastShareService } from "./broadcast-share.service";
import { BroadcastsService, LIVE_BROADCAST_STATUSES } from "./broadcasts.service";
import { VoiceTranscriptionService } from "../voice-attachments/voice-transcription.service";
import { buildMissingPersonBroadcastPreview } from "../notifications/citizen-notification-copy";
import {
  CreateCitizenBroadcastCommentDto,
  CreateMissingPersonBroadcastDto,
  CreateStolenVehicleBroadcastDto,
  maskRegistrationNumber,
  ReportBroadcastDto,
  ReactToCitizenBroadcastCommentDto,
  ResolveBroadcastDto,
  SubmitBroadcastSightingDto,
  UpdateCitizenBroadcastCommentDto,
  validateBroadcastReportReason,
  validateMissingPersonBroadcastDto,
  validateStolenVehicleBroadcastDto,
  WithdrawBroadcastDto,
} from "./dto/citizen-broadcast.dto";

const DEFAULT_EXPIRY_DAYS = 30;

const BROADCAST_MEDIA_TYPES = new Set(["image", "video", "audio"]);
const SIGHTING_LOCATION_MODES = new Set(["CURRENT_GPS", "MANUAL"]);

function normalizedOptionalText(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > maxLength) {
    throw new BadRequestException(`Location text must not exceed ${maxLength} characters`);
  }
  return text || undefined;
}

function sanitizeBroadcastAttachments(raw: unknown): Array<Record<string, string | number>> {
  if (!Array.isArray(raw)) return [];
  const attachments: Array<Record<string, string | number>> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const mediaType = String(row.mediaType ?? "").trim().toLowerCase();
    const objectKey = String(row.objectKey ?? "").trim();
    const bucket = String(row.bucket ?? "").trim();
    const contentType = String(row.contentType ?? "").trim();
    if (!BROADCAST_MEDIA_TYPES.has(mediaType) || !objectKey || !bucket || !contentType) continue;
    if (objectKey.includes("..") || !objectKey.startsWith("evidence/broadcast-")) continue;
    const sanitized: Record<string, string | number> = {
      mediaType,
      objectKey,
      bucket,
      contentType,
      fileName: String(row.fileName ?? "").trim() || `${mediaType}-attachment`,
      clientAttachmentId: String(row.clientAttachmentId ?? "").trim(),
      label: String(row.label ?? "").trim(),
    };
    const fileHash = String(row.fileHash ?? "").trim();
    if (fileHash) sanitized.fileHash = fileHash;
    const sizeBytes = Number(row.sizeBytes);
    if (Number.isInteger(sizeBytes) && sizeBytes > 0) sanitized.sizeBytes = sizeBytes;
    const durationSeconds = Number(row.durationSeconds);
    if (Number.isInteger(durationSeconds) && durationSeconds > 0) sanitized.durationSeconds = durationSeconds;
    const selectedLanguage = String(row.selectedLanguage ?? "").trim();
    if (selectedLanguage) sanitized.selectedLanguage = selectedLanguage;
    const capturedAt = String(row.capturedAt ?? "").trim();
    if (capturedAt && !Number.isNaN(new Date(capturedAt).getTime())) sanitized.capturedAt = capturedAt;
    attachments.push(sanitized);
    if (attachments.length >= 8) break;
  }
  return attachments;
}

function normalizeVehicleYear(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number.parseInt(`${value}`, 10);
  if (!Number.isFinite(parsed) || parsed < 1886 || parsed > 3000) return undefined;
  return parsed;
}

function sanitizeVehiclePhotoObjectKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const keys: string[] = [];
  for (const candidate of raw) {
    const key = String(candidate ?? "").trim();
    if (!key || key.includes("..") || key.length > 512) continue;
    keys.push(key);
    if (keys.length >= 8) break;
  }
  return keys;
}

@Injectable()
export class BroadcastCitizenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly broadcastsService: BroadcastsService,
    private readonly broadcastQueue: BroadcastQueueService,
    private readonly lifecycle: BroadcastLifecycleService,
    private readonly share: BroadcastShareService,
    @Optional() private readonly voiceTranscription?: VoiceTranscriptionService,
  ) {}

  async presignMedia(
    actor: JwtPayload,
    dto: { fileName?: string; contentType?: string; mediaType?: string; sizeBytes?: number },
  ) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    if (!dto.fileName || !dto.contentType || !dto.mediaType) {
      throw new BadRequestException("fileName, contentType, and mediaType are required");
    }
    validateEvidenceUpload(dto.contentType, dto.sizeBytes);
    const objectKey = evidenceObjectKey(`broadcast-${actor.sub}`, dto.fileName);
    const signed = await createStorageUploadUrl(objectKey, 300, dto.contentType);
    return {
      data: {
        bucket: signed.bucket,
        objectKey,
        uploadUrl: signed.url,
        requiredHeaders: { "content-type": dto.contentType },
        expiresInSeconds: signed.expiresInSeconds,
      },
    };
  }

  async createMissingPerson(dto: CreateMissingPersonBroadcastDto, actor: JwtPayload) {
    validateMissingPersonBroadcastDto(dto);
    const attachments = sanitizeBroadcastAttachments(dto.metadata?.attachments);
    const { attachments: _ignoredAttachments, ...safeMetadata } = (dto.metadata ?? {}) as Record<string, unknown>;
    return this.createCitizenBroadcast(BroadcastType.MissingPerson, dto, actor, {
      title: `Missing person: ${dto.fullName.trim()}`,
      body: this.buildMissingPersonBody(dto),
      metadata: {
        ...safeMetadata,
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
        ...(attachments.length > 0 ? { attachments } : {}),
      },
      latitude: dto.lastSeenLatitude,
      longitude: dto.lastSeenLongitude,
    });
  }

  async createStolenVehicle(dto: CreateStolenVehicleBroadcastDto, actor: JwtPayload) {
    validateStolenVehicleBroadcastDto(dto);
    const attachments = sanitizeBroadcastAttachments(dto.metadata?.attachments);
    const { attachments: _ignoredAttachments, ...safeMetadata } = (dto.metadata ?? {}) as Record<string, unknown>;
    const sourceVehicleId =
      typeof safeMetadata.sourceVehicleId === "string" && safeMetadata.sourceVehicleId.trim().length > 0
        ? safeMetadata.sourceVehicleId.trim()
        : undefined;
    const vehiclePhotos = sanitizeBroadcastAttachments(safeMetadata.vehiclePhotos)
      .filter((attachment) => attachment.mediaType === "image");
    const vehiclePhotoObjectKeys = vehiclePhotos.length > 0
      ? vehiclePhotos.map((attachment) => String(attachment.objectKey))
      : sanitizeVehiclePhotoObjectKeys(safeMetadata.vehiclePhotoObjectKeys);
    const normalizedYear = normalizeVehicleYear(dto.year ?? safeMetadata.year);
    const vinLastFour = dto.vinLastFour?.trim() || (typeof safeMetadata.vinLastFour === "string"
      ? safeMetadata.vinLastFour.trim()
      : undefined);
    return this.createCitizenBroadcast(BroadcastType.StolenVehicle, dto, actor, {
      title: `Stolen vehicle: ${dto.make.trim()} ${dto.model.trim()} (${maskRegistrationNumber(dto.registrationNumber)})`,
      body: this.buildStolenVehicleBody(dto),
      metadata: {
        ...safeMetadata,
        vehicleType: dto.vehicleType,
        make: dto.make,
        model: dto.model,
        ...(normalizedYear !== undefined ? { year: normalizedYear } : {}),
        colour: dto.colour,
        registrationMasked: maskRegistrationNumber(dto.registrationNumber),
        registrationNumber: dto.registrationNumber.trim(),
        stolenAt: dto.stolenAt,
        lastSeenAt: dto.lastSeenAt,
        lastKnownLocation: dto.lastKnownLocation,
        distinguishingFeatures: dto.distinguishingFeatures,
        theftDescription: dto.theftDescription,
        policeReportReference: dto.policeReportReference,
        ...(vinLastFour ? { vinLastFour } : {}),
        ...(sourceVehicleId ? { sourceVehicleId } : {}),
        ...(vehiclePhotoObjectKeys.length > 0 ? { vehiclePhotoObjectKeys } : {}),
        ...(vehiclePhotos.length > 0 ? { vehiclePhotos } : {}),
        directionOfTravel: dto.directionOfTravel,
        rewardNotice: dto.rewardNotice,
        ...(attachments.length > 0 ? { attachments } : {}),
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
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, deletedAt: null, status: { not: BroadcastStatus.DeletedByAdmin as never } },
    });
    if (!broadcast) throw new NotFoundException("Broadcast not found");
    validateBroadcastReportReason(broadcast.type as BroadcastType, dto);
    const normalizedReason = dto.reason.trim();
    const normalizedDetails = dto.details?.trim();
    const existing = await this.prisma.broadcastReport.findFirst({
      where: { broadcastId: id, reporterUserId: actor.sub, reason: normalizedReason, status: "Open" },
    });
    if (existing) return { data: { id: existing.id, status: existing.status, duplicate: true } };
    const report = await this.prisma.broadcastReport.create({
      data: {
        broadcastId: id,
        reporterUserId: actor.sub,
        reason: normalizedReason,
        details: normalizedDetails,
      } as never,
    });
    await this.recordAudit(actor, "broadcast.reported", id, { reportId: report.id, reason: normalizedReason });
    return { data: { id: report.id, status: report.status } };
  }

  async addComment(id: string, dto: CreateCitizenBroadcastCommentDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    const body = dto.body?.trim();
    if (!body) throw new BadRequestException("Comment body is required");
    if (body.length > 2000) throw new BadRequestException("Comment body must not exceed 2000 characters");
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, deletedAt: null, commentsLocked: false },
    });
    if (!broadcast || !LIVE_BROADCAST_STATUSES.has(String(broadcast.status))) {
      throw new NotFoundException("Broadcast not available for comments");
    }
    if (dto.parentId) {
      const parent = await this.prisma.broadcastComment.findFirst({
        where: { id: dto.parentId, broadcastId: id, hiddenAt: null },
      });
      if (!parent) throw new BadRequestException("Reply parent must belong to this broadcast");
    }
    const comment = await this.prisma.broadcastComment.create({
      data: {
        broadcastId: id,
        authorUserId: actor.sub,
        body,
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
      include: {
        authorUser: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
        authorAdmin: { select: { id: true, displayName: true } },
        reactions: { select: { reaction: true, userId: true } },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "asc" }],
      take: 100,
    });
    return { data: comments.map((comment) => this.toPublicComment(comment)) };
  }

  async updateComment(
    id: string,
    commentId: string,
    dto: UpdateCitizenBroadcastCommentDto,
    actor: JwtPayload,
  ) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    const body = dto.body?.trim();
    if (!body) throw new BadRequestException("Comment body is required");
    if (body.length > 2000) throw new BadRequestException("Comment body must not exceed 2000 characters");
    const comment = await this.prisma.broadcastComment.findFirst({ where: { id: commentId, broadcastId: id, hiddenAt: null } });
    if (!comment) throw new NotFoundException("Comment not found");
    if (comment.authorUserId !== actor.sub) throw new ForbiddenException("Only the author can edit this comment");
    const updated = await this.prisma.broadcastComment.update({ where: { id: commentId }, data: { body } });
    await this.recordAudit(actor, "broadcast.comment_updated", id, { commentId });
    return { data: updated };
  }

  async deleteComment(id: string, commentId: string, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    const comment = await this.prisma.broadcastComment.findFirst({ where: { id: commentId, broadcastId: id, hiddenAt: null } });
    if (!comment) throw new NotFoundException("Comment not found");
    if (comment.authorUserId !== actor.sub) throw new ForbiddenException("Only the author can delete this comment");
    await this.prisma.broadcastComment.update({ where: { id: commentId }, data: { hiddenAt: new Date() } });
    await this.recordAudit(actor, "broadcast.comment_deleted", id, { commentId });
    return { data: { id: commentId, deleted: true } };
  }

  async reactToComment(
    id: string,
    commentId: string,
    dto: ReactToCitizenBroadcastCommentDto,
    actor: JwtPayload,
  ) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    if (!new Set(["Helpful", "Thanks"]).has(dto.reaction)) {
      throw new BadRequestException("Unsupported comment reaction");
    }
    const comment = await this.prisma.broadcastComment.findFirst({ where: { id: commentId, broadcastId: id, hiddenAt: null } });
    if (!comment) throw new NotFoundException("Comment not found");
    const reaction = await (this.prisma as any).broadcastCommentReaction.upsert({
      where: { commentId_userId_reaction: { commentId, userId: actor.sub, reaction: dto.reaction } },
      update: {},
      create: { commentId, userId: actor.sub, reaction: dto.reaction },
    });
    return { data: reaction };
  }

  async submitSighting(id: string, dto: SubmitBroadcastSightingDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    if (!dto.description?.trim()) throw new BadRequestException("Sighting description is required");
    const locationMode = String(dto.locationMode ?? "").trim().toUpperCase();
    if (!SIGHTING_LOCATION_MODES.has(locationMode)) {
      throw new BadRequestException("locationMode must be CURRENT_GPS or MANUAL");
    }
    if ((dto.latitude === undefined) !== (dto.longitude === undefined)) {
      throw new BadRequestException("latitude and longitude must be supplied together");
    }
    if (locationMode === "CURRENT_GPS" && (dto.latitude === undefined || dto.longitude === undefined)) {
      throw new BadRequestException("Current GPS location mode requires latitude and longitude");
    }
    if (dto.latitude !== undefined && (!Number.isFinite(dto.latitude) || dto.latitude < -90 || dto.latitude > 90)) {
      throw new BadRequestException("latitude must be between -90 and 90");
    }
    if (dto.longitude !== undefined && (!Number.isFinite(dto.longitude) || dto.longitude < -180 || dto.longitude > 180)) {
      throw new BadRequestException("longitude must be between -180 and 180");
    }
    const observedAt = dto.observedAt ? new Date(dto.observedAt) : new Date();
    if (Number.isNaN(observedAt.getTime())) {
      throw new BadRequestException("observedAt must be a valid date-time");
    }
    const capturedAt = dto.capturedAt ? new Date(dto.capturedAt) : undefined;
    if (capturedAt && Number.isNaN(capturedAt.getTime())) {
      throw new BadRequestException("capturedAt must be a valid date-time");
    }
    const state = normalizedOptionalText(dto.state, 100);
    const cityTown = normalizedOptionalText(dto.cityTown, 100);
    const streetAddress = normalizedOptionalText(dto.streetAddress, 200);
    const countryCode = normalizedOptionalText(dto.countryCode, 2)?.toUpperCase();
    const displayAddress = normalizedOptionalText(dto.displayAddress, 300);
    if (locationMode === "MANUAL" && (!state || !cityTown || !streetAddress)) {
      throw new BadRequestException("Manual location requires State, City/Town, and Street/Road Address");
    }
    const attachments = sanitizeBroadcastAttachments(dto.attachments);
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, deletedAt: null, commentsLocked: false },
      include: { incident: { select: { assignedAgencyId: true } } },
    });
    if (!broadcast) {
      throw new NotFoundException("Broadcast not found");
    }
    if (!LIVE_BROADCAST_STATUSES.has(String(broadcast.status))) {
      throw new BadRequestException(`Sightings can only be submitted to live broadcasts. Current status: ${String(broadcast.status)}`);
    }
    if (dto.clientSightingId) {
      const existing = await this.prisma.broadcastSighting.findFirst({
        where: { broadcastId: id, reporterUserId: actor.sub, metadata: { path: ["clientSightingId"], equals: dto.clientSightingId } },
      });
      if (existing) return { data: { id: existing.id, status: "Received" }, duplicate: true };
    }
    const sighting = await this.prisma.broadcastSighting.create({
      data: {
        broadcastId: id,
        reporterUserId: actor.sub,
        observedAt,
        latitude: dto.latitude,
        longitude: dto.longitude,
        approximateArea: dto.approximateArea?.trim(),
        description: dto.description.trim(),
        confidence: dto.confidence,
        anonymousPublic: dto.anonymousPublic === true,
        directionOfTravel: dto.directionOfTravel,
        metadata: {
          ...(dto.clientSightingId ? { clientSightingId: dto.clientSightingId } : {}),
          locationMode,
          location: {
            ...(countryCode ? { countryCode } : {}),
            ...(state ? { state } : {}),
            ...(cityTown ? { cityTown } : {}),
            ...(streetAddress ? { streetAddress } : {}),
            ...(displayAddress ? { displayAddress } : {}),
            ...(capturedAt ? { capturedAt: capturedAt.toISOString() } : {}),
          },
          ...(attachments.length > 0 ? { attachments } : {}),
        },
      } as never,
    });
    await this.persistBroadcastMedia({
      broadcastId: id,
      sightingId: sighting.id,
      uploaderId: actor.sub,
      role: "SightingEvidence",
      attachments,
    });
    await this.recordAudit(actor, "broadcast.sighting_submitted", id, { sightingId: sighting.id });
    await this.notifyBroadcastOwnerOfSighting(broadcast, sighting.id);
    await this.recordAudit(actor, "broadcast.sighting_authority_routed", id, {
      sightingId: sighting.id,
      jurisdictionId: broadcast.jurisdictionId,
      country: broadcast.country,
      state: broadcast.state,
      lga: broadcast.lga,
      assignedAgencyId: broadcast.incident?.assignedAgencyId ?? null,
      authorityRouting: "owner_notified_and_audited",
    });
    return { data: { id: sighting.id, status: "Received" } };
  }

  async listSightings(id: string, actor: JwtPayload) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, creatorUserId: true },
    });
    if (!broadcast) throw new NotFoundException("Broadcast not found");
    const isAdmin = actor.typ === "admin";
    const isOwner = actor.typ === "user" && actor.sub === broadcast.creatorUserId;
    if (!isAdmin && !isOwner) {
      throw new ForbiddenException("You are not allowed to view sightings for this broadcast");
    }

    const sightings = await this.prisma.broadcastSighting.findMany({
      where: { broadcastId: id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return {
      data: sightings.map((sighting) => this.toSightingProjection(sighting as unknown as Record<string, unknown>, { isAdmin })),
    };
  }

  async getSighting(id: string, sightingId: string, actor: JwtPayload) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        creatorUserId: true,
        type: true,
        title: true,
        metadata: true,
      },
    });
    if (!broadcast) throw new NotFoundException("Broadcast not found");
    const isAdmin = actor.typ === "admin";
    const isOwner = actor.typ === "user" && actor.sub === broadcast.creatorUserId;
    if (!isAdmin && !isOwner) {
      throw new ForbiddenException("You are not allowed to view this sighting");
    }
    const sighting = await this.prisma.broadcastSighting.findFirst({
      where: { id: sightingId, broadcastId: id },
    });
    if (!sighting) throw new NotFoundException("Sighting not found");
    const projection = this.toSightingProjection(
      sighting as unknown as Record<string, unknown>,
      { isAdmin },
    );
    const metadata = (sighting.metadata as Record<string, unknown> | null) ?? {};
    const mediaClient = (this.prisma as any).broadcastMedia;
    const persistedMedia = typeof mediaClient?.findMany === "function"
      ? await mediaClient.findMany({ where: { sightingId, broadcastId: id, deletedAt: null }, orderBy: { createdAt: "asc" } })
      : [];
    const attachmentSource = persistedMedia.length > 0 ? persistedMedia : (Array.isArray(metadata.attachments) ? metadata.attachments : []);
    const attachments = await Promise.all(
      attachmentSource
        .filter((item) => item && typeof item === "object")
        .map(async (item) => {
          const row = item as Record<string, unknown>;
          const objectKey = String(row.objectKey ?? "").trim();
          if (!objectKey || objectKey.includes("..") || !objectKey.startsWith("evidence/broadcast-")) return null;
          const signed = await createStorageDownloadUrl(objectKey, 300);
          return {
            id: row.id ? String(row.id) : null,
            mediaType: String(row.mediaType ?? "").toLowerCase(),
            label: String(row.label ?? "").trim() || "Attachment",
            contentType: String(row.contentType ?? ""),
            durationSeconds: Number(row.durationSeconds) || null,
            transcriptionStatus: row.transcriptionStatus ?? null,
            selectedLanguage: row.selectedLanguage ?? null,
            detectedLanguage: row.detectedLanguage ?? null,
            url: signed.url,
          };
        }),
    );
    const broadcastMetadata = (broadcast.metadata as Record<string, unknown> | null) ?? {};
    const vehicleSummary = [broadcastMetadata.colour, broadcastMetadata.make, broadcastMetadata.model]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join(" ");
    const registration = String(broadcastMetadata.registrationNumber ?? "").trim();
    const subjectSummary = vehicleSummary
      ? `${vehicleSummary}${registration ? ` (${maskRegistrationNumber(registration)})` : ""}`
      : String(broadcastMetadata.fullName ?? broadcast.title);
    return {
      data: {
        ...projection,
        attachments: attachments.filter(Boolean),
        broadcast: {
          id: broadcast.id,
          type: broadcast.type,
          title: broadcast.title,
          subjectSummary,
        },
      },
    };
  }

  private toPublicComment(comment: Record<string, unknown>) {
    const isOfficial = comment.isOfficial === true;
    const metadata = (comment.metadata as Record<string, unknown> | null) ?? {};
    const label = isOfficial
      ? "Official Admin Update"
      : metadata.isSighting === true
        ? "Verified Sighting"
        : "User Comment";
    const authorUser = comment.authorUser as Record<string, unknown> | null | undefined;
    const authorAdmin = comment.authorAdmin as Record<string, unknown> | null | undefined;
    const profile = authorUser?.profile as Record<string, unknown> | null | undefined;
    const citizenName = [profile?.firstName, profile?.lastName]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(" ");
    const reactions = Array.isArray(comment.reactions)
      ? comment.reactions as Array<Record<string, unknown>>
      : [];
    const reactionCounts = reactions.reduce<Record<string, number>>((counts, reaction) => {
      const key = String(reaction.reaction ?? "");
      if (key) counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
    return {
      id: comment.id,
      body: comment.body,
      label,
      parentId: comment.parentId ?? null,
      authorUserId: comment.authorUserId ?? null,
      authorName: isOfficial
        ? String(authorAdmin?.displayName ?? "Official Admin")
        : citizenName || "Citizen",
      isOfficial,
      isPinned: comment.isPinned === true,
      reactions: reactionCounts,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  private async persistBroadcastMedia(input: {
    broadcastId: string;
    sightingId?: string;
    uploaderId: string;
    role: "VehiclePhoto" | "IncidentEvidence" | "SightingEvidence";
    attachments: Array<Record<string, string | number>>;
  }) {
    for (const attachment of input.attachments) {
      const objectKey = String(attachment.objectKey ?? "");
      if (!objectKey) continue;
      const mediaType = String(attachment.mediaType ?? "").toLowerCase();
      const prismaMediaType = mediaType === "image" ? "Image" : mediaType === "video" ? "Video" : "Audio";
      const created = await (this.prisma as any).broadcastMedia.upsert({
        where: { objectKey },
        update: {},
        create: {
          broadcastId: input.broadcastId,
          sightingId: input.sightingId,
          uploaderId: input.uploaderId,
          role: input.role,
          mediaType: prismaMediaType,
          bucket: String(attachment.bucket ?? ""),
          objectKey,
          contentType: String(attachment.contentType ?? ""),
          fileHash: String(attachment.fileHash ?? "").trim() || null,
          sizeBytes: Number.isFinite(Number(attachment.sizeBytes))
            ? BigInt(Number(attachment.sizeBytes))
            : null,
          capturedAt: attachment.capturedAt ? new Date(String(attachment.capturedAt)) : null,
          durationSeconds: Number.isFinite(Number(attachment.durationSeconds))
            ? Number(attachment.durationSeconds)
            : null,
          clientAttachmentId: String(attachment.clientAttachmentId ?? "").trim() || null,
          selectedLanguage: String(attachment.selectedLanguage ?? "").trim() || null,
          transcriptionStatus: mediaType === "audio" ? "Uploaded" : null,
        },
      });
      if (mediaType === "audio") {
        await this.voiceTranscription?.enqueueBroadcastMediaTranscription(String(created.id));
      }
    }
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

    await this.persistBroadcastMedia({
      broadcastId: broadcast.id,
      uploaderId: actor.sub,
      role: "IncidentEvidence",
      attachments: sanitizeBroadcastAttachments(payload.metadata.attachments),
    });
    await this.persistBroadcastMedia({
      broadcastId: broadcast.id,
      uploaderId: actor.sub,
      role: "VehiclePhoto",
      attachments: sanitizeBroadcastAttachments(payload.metadata.vehiclePhotos)
        .filter((attachment) => attachment.mediaType === "image"),
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

  private toSightingProjection(
    sighting: Record<string, unknown>,
    options: { isAdmin: boolean },
  ) {
    const metadata = (sighting.metadata as Record<string, unknown> | null) ?? {};
    const rawAttachments = Array.isArray(metadata.attachments) ? metadata.attachments : [];
    const attachmentSummaries = rawAttachments
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const row = item as Record<string, unknown>;
        return {
          mediaType: String(row.mediaType ?? ""),
          label: String(row.label ?? "").trim() || "Attachment",
          fileName: String(row.fileName ?? "").trim() || null,
        };
      });

    return {
      id: sighting.id,
      broadcastId: sighting.broadcastId,
      reportedAt: sighting.createdAt,
      observedAt: sighting.observedAt,
      locationMode: String(metadata.locationMode ?? "NOT_PROVIDED"),
      location: metadata.location && typeof metadata.location === "object" ? metadata.location : null,
      approximateArea: sighting.approximateArea ?? null,
      description: sighting.description,
      confidence: sighting.confidence ?? null,
      directionOfTravel: sighting.directionOfTravel ?? null,
      attachments: attachmentSummaries,
      reporter: options.isAdmin ? { reporterUserId: sighting.reporterUserId } : { label: "Citizen sighting" },
      ...(options.isAdmin ? { latitude: sighting.latitude ?? null, longitude: sighting.longitude ?? null } : {}),
    };
  }

  private async notifyBroadcastOwnerOfSighting(
    broadcast: Record<string, unknown>,
    sightingId: string,
  ) {
    const ownerUserId = typeof broadcast.creatorUserId === "string" ? broadcast.creatorUserId : "";
    if (!ownerUserId) return;
    const metadata = (broadcast.metadata as Record<string, unknown> | null) ?? {};
    const make = String(metadata.make ?? "").trim();
    const model = String(metadata.model ?? "").trim();
    const vehicleName = [make, model].filter(Boolean).join(" ").trim() || "vehicle";
    const subject = String(broadcast.type) === BroadcastType.MissingPerson
      ? "missing person"
      : vehicleName;
    await this.notificationsService.create({
      userId: ownerUserId,
      broadcastId: String(broadcast.id),
      type: "BroadcastSightingAlert",
      priority: "High",
      channels: ["push"],
      title: "New sighting reported",
      body: `Someone reported a possible sighting for your ${subject} broadcast.`,
      metadata: {
        broadcastId: String(broadcast.id),
        sightingId,
        idempotencyKey: `broadcast-sighting:${sightingId}:${ownerUserId}`,
        deepLink: `/broadcasts/${String(broadcast.id)}/sightings/${sightingId}`,
      },
    });
  }

  private recordAudit(actor: JwtPayload, action: string, entityId: string, metadata: Record<string, unknown>) {
    return this.audit.record({ actor, action, entityType: "broadcasts", entityId, metadata });
  }
}
