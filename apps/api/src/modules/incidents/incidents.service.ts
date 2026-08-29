import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  AdminRoleName,
  buildIncidentPublicReference,
  IncidentPriority,
  IncidentStatus,
  IncidentType,
  ResolutionSource,
} from "@the-eye/shared";
import {
  reportSubmittedNotificationCopy,
  resolveCancellationReason,
} from "../notifications/citizen-notification-copy";
import { hashPassword, randomToken } from "../../common/auth/crypto";
import { createStorageUploadUrl, createStorageDownloadUrl, evidenceObjectKey, validateEvidenceUpload, assertEvidenceObjectKey } from "../../common/storage/s3-presign";
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
import { PrismaService } from "../prisma/prisma.service";
import { VerificationService } from "../verification/verification.service";
import { NotificationsService } from "../notifications/notifications.service";
import { LocationTrackingService } from "../dispatch/location-tracking.service";
import { LocationRetryService } from "../dispatch/location-retry.service";
import { isIncidentLocationPersistenceError } from "../dispatch/location-persistence.error";
import { IncidentTimelineService } from "../dispatch/incident-timeline.service";
import { EtaService } from "../dispatch/eta.service";
import { DispatchService } from "../dispatch/dispatch.service";
import { EmergencyClassificationService } from "../dispatch/emergency-classification.service";
import type { SosReportDto } from "../dispatch/dto/dispatch.dto";
import {
  canActorTransitionIncident,
  canReporterCancelDirectly,
  canReporterRequestCancellation,
  canTransitionIncident,
  isActiveIncidentStatus,
  isTerminalIncidentStatus,
} from "./incident-lifecycle";
import { buildIncidentPresentation } from "./incident-presentation.mapper";
import { JurisdictionResolutionService } from "./jurisdiction-resolution.service";
import { emptyOptionalString, runNonCriticalWrite } from "./incident-write-side-effects";
import { incidentHasSubmissionCoordinates } from "./location-status";
import {
  ConfirmIncidentMediaDto,
  PresignIncidentMediaDto,
  ReportIncidentDto,
  UpdateIncidentLocationDto,
  validateIncidentLocationDto,
  validateMediaDraft,
  validateReportIncidentDto,
} from "./dto/report-incident.dto";
import { VoiceTranscriptionService } from "../voice-attachments/voice-transcription.service";
import { IncidentCommunicationsService } from "../incident-communications/incident-communications.service";
import { DangerDetectionService } from "../danger-detection/danger-detection.service";

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly metrics: MetricsService,
    private readonly verification: VerificationService,
    private readonly notifications: NotificationsService,
    private readonly dispatchService: DispatchService,
    private readonly emergencyClassification: EmergencyClassificationService,
    private readonly locationTracking: LocationTrackingService,
    private readonly locationRetry: LocationRetryService,
    private readonly incidentTimeline: IncidentTimelineService,
    private readonly etaService: EtaService,
    private readonly jurisdictionResolution: JurisdictionResolutionService,
    private readonly voiceTranscription: VoiceTranscriptionService,
    @Optional() private readonly incidentCommunications?: IncidentCommunicationsService,
    @Optional() private readonly dangerDetection?: DangerDetectionService,
  ) {}

  async list(
    actor?: JwtPayload,
    filters: { status?: string; priority?: string; type?: string; q?: string } = {},
    query: CursorPageQuery = {},
  ) {
    const limit = resolvePageLimit(query.limit);
    if (query.cursor?.trim() && !decodeDateIdCursor(query.cursor)) {
      throw new BadRequestException("cursor is invalid");
    }
    const cursor = decodeDateIdCursor(query.cursor);
    const filterWhere: Record<string, unknown> = {};
    if (filters.status?.trim()) filterWhere.status = filters.status.trim();
    if (filters.priority?.trim()) filterWhere.priority = filters.priority.trim();
    if (filters.type?.trim()) filterWhere.type = filters.type.trim();
    const search = filters.q?.trim();
    const searchWhere = search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { address: { contains: search, mode: "insensitive" } },
            { lga: { contains: search, mode: "insensitive" } },
            { state: { contains: search, mode: "insensitive" } },
            { country: { contains: search, mode: "insensitive" } },
            { reporter: { profile: { firstName: { contains: search, mode: "insensitive" } } } },
            { reporter: { profile: { lastName: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {};
    const scopeWhere = this.incidentScopeWhere(actor);
    const filteredScopeWhere = { AND: [scopeWhere, filterWhere, searchWhere] };
    const rows = await this.prisma.incident.findMany({
      where: { AND: [scopeWhere, filterWhere, searchWhere, dateIdCursorWhere(cursor)] } as never,
      include: {
        media: true,
        reporter: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
        timeline: { orderBy: { createdAt: "desc" }, take: 10 },
        statusHistory: { orderBy: { createdAt: "desc" }, take: 5 },
        locationUpdates: { orderBy: { capturedAt: "desc" }, take: 1 },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const activeStatuses = [
      IncidentStatus.Submitted,
      IncidentStatus.Received,
      IncidentStatus.Verifying,
      IncidentStatus.Verified,
      IncidentStatus.Assigned,
      IncidentStatus.Responding,
      IncidentStatus.UnderControl,
      IncidentStatus.CancellationRequested,
    ];
    const [totalReports, activeReports, criticalReports, verifyingReports] = await Promise.all([
      this.prisma.incident.count({ where: filteredScopeWhere as never }),
      this.prisma.incident.count({ where: { AND: [filteredScopeWhere, { status: { in: activeStatuses } }] } as never }),
      this.prisma.incident.count({ where: { AND: [filteredScopeWhere, { priority: IncidentPriority.P1LifeThreatening }] } as never }),
      this.prisma.incident.count({ where: { AND: [filteredScopeWhere, { status: IncidentStatus.Verifying }] } as never }),
    ]);
    return {
      ...buildCursorPage(rows, limit, (item) => encodeDateIdCursor(item.createdAt, item.id)),
      meta: { totalReports, activeReports, criticalReports, verifyingReports },
    };
  }

  async reportEmergency(dto: ReportIncidentDto, actor?: JwtPayload) {
    return this.report({ ...dto, type: IncidentType.Emergency, priority: IncidentPriority.P1LifeThreatening, notifyEmergencyContacts: dto.notifyEmergencyContacts ?? true }, actor, true);
  }

  async reportSos(dto: SosReportDto, actor?: JwtPayload) {
    const classified = this.emergencyClassification.classifySosReport(dto);
    const reportDto = this.emergencyClassification.toReportIncidentDto(dto);
    const response = await this.report(reportDto, actor, true);
    const incidentId = response.id as string;

    const existing = await this.prisma.incident.findUnique({ where: { id: incidentId }, select: { metadata: true } });
    await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        metadata: {
          ...((existing?.metadata as Record<string, unknown>) ?? {}),
          ...this.emergencyClassification.buildIncidentMetadata(dto, classified),
        },
      } as never,
    });

    await this.audit.record({
      actor,
      actorType: dto.anonymous ? "anonymous" : actor?.typ ?? "system",
      action: "incident.sos_classified",
      entityType: "incidents",
      entityId: incidentId,
      afterState: {
        emergencyCategory: classified.category,
        incidentType: classified.incidentType,
        silent: classified.silent,
      },
      metadata: { suggestedAgencyTypes: classified.suggestedAgencyTypes },
    });

    return { ...response, emergencyCategory: classified.category, silent: classified.silent };
  }

  async report(dto: ReportIncidentDto, actor?: JwtPayload, emergencyFastPath = false) {
    const startedAt = process.hrtime.bigint();
    const intake = emergencyFastPath ? "emergency_fast_path" : "standard";
    const incidentType = String(dto.type);
    try {
      return await this.reportInternal(dto, actor, emergencyFastPath);
    } catch (error) {
      this.metrics.recordIncidentSubmission(
        incidentType,
        intake,
        Number(process.hrtime.bigint() - startedAt) / 1e9,
        "error",
      );
      throw error;
    }
  }

  private async reportInternal(dto: ReportIncidentDto, actor?: JwtPayload, emergencyFastPath = false) {
    const startedAt = process.hrtime.bigint();
    const intake = emergencyFastPath ? "emergency_fast_path" : "standard";
    const incidentType = String(dto.type);
    validateReportIncidentDto(dto);

    const clientSubmissionId = emptyOptionalString(dto.clientSubmissionId);
    const incidentDescription = dto.description?.trim() || null;
    const incidentAddress = emptyOptionalString(dto.address);
    const incidentTitle = emptyOptionalString(dto.title) ?? this.defaultTitle(dto.type);
    if (clientSubmissionId) {
      const existing = await this.prisma.incident.findUnique({ where: { clientSubmissionId } });
      if (existing) {
        return this.buildReportResponse(existing, emergencyFastPath, true);
      }
    }

    const isAnonymous = dto.anonymous ?? !actor;
    if (!isAnonymous && actor?.typ !== "user" && actor?.typ !== "admin") {
      throw new BadRequestException("Identified reporting requires authentication");
    }

    const hasCoordinates = incidentHasSubmissionCoordinates({
      latitude: dto.manualLatitude ?? dto.latitude,
      longitude: dto.manualLongitude ?? dto.longitude,
      locationStatus: dto.locationStatus,
    });

    const jurisdiction = await this.jurisdictionResolution.resolve({
      latitude: hasCoordinates ? (dto.manualLatitude ?? dto.latitude ?? null) : null,
      longitude: hasCoordinates ? (dto.manualLongitude ?? dto.longitude ?? null) : null,
      actor,
    });
    const now = new Date();
    const priority = dto.priority ?? this.defaultPriority(dto.type);
    const sideEffectContext = {
      incidentId: "",
      intake,
      clientSubmissionId,
    } satisfies Parameters<typeof runNonCriticalWrite>[1];
    const nonCriticalWarnings: string[] = [];

    const incident = await this.prisma.incident.create({
      data: {
        reporterId: !isAnonymous && actor?.typ === "user" ? actor.sub : undefined,
        jurisdictionId: jurisdiction.id,
        type: dto.type as never,
        status: IncidentStatus.Submitted as never,
        priority: priority as never,
        title: incidentTitle,
        description: incidentDescription,
        address: incidentAddress,
        country: jurisdiction.country,
        state: jurisdiction.state,
        lga: jurisdiction.lga,
        latitude: hasCoordinates ? (dto.latitude ?? null) : null,
        longitude: hasCoordinates ? (dto.longitude ?? null) : null,
        manualLatitude: dto.manualLatitude,
        manualLongitude: dto.manualLongitude,
        manualAddress: dto.manualAddress,
        manualLocationAdjusted: dto.manualLatitude !== undefined && dto.manualLongitude !== undefined,
        isAnonymous,
        notifyEmergencyContacts: dto.notifyEmergencyContacts ?? false,
        clientSubmissionId: clientSubmissionId || undefined,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        submittedAt: now,
        metadata: {
          intake: emergencyFastPath ? "emergency_fast_path" : "standard",
          reportingMode: isAnonymous ? "anonymous" : "identified",
          emergencyContactNotificationRequested: dto.notifyEmergencyContacts ?? false,
          jurisdictionResolutionStatus: jurisdiction.resolutionStatus,
          jurisdictionResolutionSource: jurisdiction.resolutionSource,
          ...(dto.locationStatus ? { locationStatus: dto.locationStatus } : {}),
          ...(dto.locationSource ? { locationSource: dto.locationSource } : {}),
          ...(dto.isCached !== undefined ? { isCached: dto.isCached } : {}),
          ...(dto.ageSeconds !== undefined ? { ageSeconds: dto.ageSeconds } : {}),
          ...(dto.accuracyMeters !== undefined ? { locationAccuracyMeters: dto.accuracyMeters } : {}),
          ...(dto.capturedAt ? { locationCapturedAt: new Date(dto.capturedAt).toISOString() } : {}),
          ...(dto.quality ? { locationQuality: dto.quality } : {}),
          ...(dto.locationErrorCode ? { locationErrorCode: dto.locationErrorCode } : {}),
          ...(dto.locationRequestId ? { locationRequestId: dto.locationRequestId } : {}),
          ...(jurisdiction.distanceMeters !== undefined
            ? { jurisdictionDistanceMeters: jurisdiction.distanceMeters }
            : {}),
        },
      } as never,
    });
    sideEffectContext.incidentId = incident.id;

    await runNonCriticalWrite(
      "incident.timeline.submitted",
      sideEffectContext,
      async () => {
        await this.prisma.incidentTimeline.create({
          data: {
            incidentId: incident.id,
            actorId: !isAnonymous && actor?.typ === "user" ? actor.sub : undefined,
            actorType: isAnonymous ? "anonymous" : actor?.typ ?? "system",
            eventType: "incident.submitted",
            message: emergencyFastPath
              ? "Emergency report submitted through fast path."
              : "Incident report submitted.",
            metadata: { reportingMode: isAnonymous ? "anonymous" : "identified" },
          } as never,
        });
      },
      nonCriticalWarnings,
    );

    await runNonCriticalWrite(
      "incident.audit.created",
      sideEffectContext,
      async () => {
        await this.audit.record({
          actor,
          actorType: isAnonymous ? "anonymous" : actor?.typ ?? "system",
          action: "incident.created",
          entityType: "incidents",
          entityId: incident.id,
          afterState: { status: IncidentStatus.Submitted, priority, type: dto.type },
          metadata: { reportingMode: isAnonymous ? "anonymous" : "identified", emergencyFastPath },
        });
      },
      nonCriticalWarnings,
    );

    if (dto.media?.length) {
      if (emergencyFastPath) {
        void this.attachInitialMedia(incident.id, dto.media, actor, isAnonymous, dto.latitude, dto.longitude);
      } else {
        await this.attachInitialMedia(incident.id, dto.media, actor, isAnonymous, dto.latitude, dto.longitude);
      }
    }

    if (dto.type === IncidentType.MissingPerson && dto.missingPerson) {
      await this.createMissingPersonReport(incident.id, dto, actor);
    }

    if (dto.type === IncidentType.StolenVehicle && dto.stolenVehicle) {
      await this.createStolenVehicleReport(incident.id, dto, actor);
    }

    if (dto.notifyEmergencyContacts && !isAnonymous && actor?.typ === "user") {
      void runNonCriticalWrite(
        "incident.notifications.emergency_contacts",
        sideEffectContext,
        async () => {
          await this.createEmergencyContactNotifications(
            actor.sub,
            incident.id,
            incidentTitle,
            dto.emergencyContactIds,
          );
        },
        nonCriticalWarnings,
      );
    }

    void this.verification.verifyIncident(incident.id).catch(() => undefined);
    void this.dispatchService.runTriageForIncident(incident.id, actor).catch(() => undefined);
    void this.dangerDetection?.enqueueSource("INCIDENT", incident.id).catch(() => undefined);

    if (!isAnonymous && actor?.typ === "user") {
      void runNonCriticalWrite(
        "incident.notifications.report_submitted",
        sideEffectContext,
        async () => {
          const publicReference = buildIncidentPublicReference({
            incidentId: incident.id,
            submittedAt: incident.submittedAt,
          });
          const copy = reportSubmittedNotificationCopy(publicReference, String(dto.type));
          await this.notifications.create({
            userId: actor.sub,
            incidentId: incident.id,
            type: copy.type,
            // Push notifications are also the canonical inbox record. Creating a
            // second in-app channel row duplicates the same logical event.
            channels: ["push"],
            title: copy.title,
            body: copy.body,
            metadata: {
              ...copy.metadata,
              idempotencyKey: `incident:${incident.id}:report-submitted:${actor.sub}`,
            },
          });
        },
        nonCriticalWarnings,
      );
    }

    const result = this.buildReportResponse(incident, emergencyFastPath, false, nonCriticalWarnings);
    this.metrics.recordIncidentSubmission(
      incidentType,
      intake,
      Number(process.hrtime.bigint() - startedAt) / 1e9,
      "success",
    );
    return result;
  }

  async presignMedia(id: string, dto: PresignIncidentMediaDto, actor?: JwtPayload) {
    await this.get(id, actor);
    if (!dto.fileName || !dto.contentType || !dto.mediaType) throw new BadRequestException("fileName, contentType, and mediaType are required");
    validateEvidenceUpload(dto.contentType, dto.sizeBytes);

    const objectKey = evidenceObjectKey(id, dto.fileName);
    const signed = await createStorageUploadUrl(objectKey, 300, dto.contentType);
    return {
      bucket: signed.bucket,
      objectKey,
      uploadUrl: signed.url,
      requiredHeaders: { "content-type": dto.contentType },
      expiresInSeconds: signed.expiresInSeconds,
    };
  }

  async confirmMedia(id: string, dto: ConfirmIncidentMediaDto, actor?: JwtPayload) {
    validateMediaDraft(dto);
    assertEvidenceObjectKey(id, dto.objectKey, dto.bucket, dto.contentType);
    await this.get(id, actor);

    const existing = await (this.prisma as any).incidentMedia.findUnique({
      where: { fileHash: dto.fileHash },
    });
    if (existing) {
      if (
        existing.incidentId !== id ||
        existing.bucket !== dto.bucket
      ) {
        throw new ConflictException("Evidence is already associated with another upload");
      }
      return this.toIncidentMediaResponse(existing);
    }

    const media = await (this.prisma as any).incidentMedia.create({
      data: await this.buildIncidentMediaCreateData(id, dto, actor),
    });

    if (dto.mediaType === "Audio") {
      void this.voiceTranscription.enqueueIncidentMediaTranscription(media.id).catch(() => undefined);
    }

    const timelineMessage = evidenceTimelineMessage(dto.mediaType);
    await this.prisma.incidentTimeline.create({
      data: {
        incidentId: id,
        actorId: actor?.typ === "user" ? actor.sub : undefined,
        actorType: actor?.typ ?? "system",
        eventType: "incident.media_attached",
        message: timelineMessage,
        metadata: { mediaId: media.id, fileHash: dto.fileHash, mediaType: dto.mediaType },
      },
    });

    return this.toIncidentMediaResponse(media);
  }

  async submitWrittenUpdate(
    id: string,
    body: { text: string; clientActionId?: string },
    actor?: JwtPayload,
  ) {
    const text = body.text?.trim();
    if (!text) throw new BadRequestException("Update text is required");

    const incident = await this.get(id, actor);
    if (actor?.typ !== "user" || incident.reporterId !== actor.sub) {
      throw new ForbiddenException("Only the reporter can add updates");
    }
    if (!isActiveIncidentStatus(incident.status as IncidentStatus)) {
      throw new BadRequestException("Cannot add updates to a closed incident");
    }

    await this.prisma.incidentTimeline.create({
      data: {
        incidentId: id,
        actorId: actor.sub,
        actorType: "user",
        eventType: "incident.reporter_update",
        message: "Reporter added additional information.",
        metadata: {
          text,
          clientActionId: body.clientActionId,
        },
      },
    });

    if (this.incidentCommunications && actor) {
      try {
        await this.incidentCommunications.sendMessage(
          id,
          actor,
          {
            messageType: "Text",
            body: text,
            clientMessageId: body.clientActionId,
            metadata: { source: "reporter_written_update" },
          },
          { skipPush: true },
        );
      } catch {
        // Conversation may be unavailable; timeline remains the durable record.
      }
    }

    await this.prisma.incident.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        statusVersion: { increment: 1 },
      },
    });

    return { ok: true, surfacedInCommunication: Boolean(this.incidentCommunications) };
  }

  async cancelEmergencyWithBody(
    id: string,
    body: { reason?: string; reasonCode?: string; reasonText?: string },
    actor?: JwtPayload,
  ) {
    try {
      const resolved = resolveCancellationReason(body);
      return this.cancelEmergency(id, resolved.reason, actor, {
        reasonCode: resolved.reasonCode,
        reasonText: resolved.reasonText,
      });
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  async requestCancellationWithBody(
    id: string,
    body: { reason?: string; reasonCode?: string; reasonText?: string },
    actor?: JwtPayload,
  ) {
    try {
      const resolved = resolveCancellationReason(body);
      return this.requestCancellation(id, resolved.reason, actor, {
        reasonCode: resolved.reasonCode,
        reasonText: resolved.reasonText,
      });
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  async get(id: string, actor?: JwtPayload) {
    const incident = await this.prisma.incident.findFirst({
      where: { id, ...this.incidentScopeWhere(actor) },
      include: {
        media: true,
        reporter: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
        assignedAgency: { select: { name: true } },
        timeline: { include: { actor: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } } }, orderBy: { createdAt: "asc" } },
        statusHistory: { include: { changedBy: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } } }, orderBy: { createdAt: "asc" } },
        locationUpdates: { orderBy: { capturedAt: "asc" }, take: 500 },
      },
    });
    if (!incident) throw new NotFoundException("Incident not found or outside your scope");
    await this.audit.record({
      actor,
      action: "incident.viewed",
      entityType: "incidents",
      entityId: id,
      metadata: { status: incident.status, priority: incident.priority },
    });
    return incident;
  }

  async updateStatus(id: string, status: IncidentStatus, note?: string, actor?: JwtPayload) {
    if (actor?.role === AdminRoleName.OversightAuditor) throw new ForbiddenException("Oversight Auditor cannot modify incidents");
    if ((status === IncidentStatus.Closed || status === IncidentStatus.FalseReport) && !note?.trim()) {
      throw new BadRequestException("A reason is required to close an incident or mark it false");
    }

    const incident = await this.get(id, actor);
    const currentStatus = incident.status as IncidentStatus;
    if (!canTransitionIncident(currentStatus, status)) {
      throw new BadRequestException(`Incident cannot move from ${currentStatus} to ${status}`);
    }
    if (!canActorTransitionIncident(actor, currentStatus, status)) {
      throw new ForbiddenException(`You are not allowed to transition incident from ${currentStatus} to ${status}`);
    }

    const resolutionSource =
      status === IncidentStatus.Resolved ? this.inferResolutionSource(actor) : undefined;

    const updated = await this.transitionIncidentStatus(id, incident, status, {
      note,
      actor,
      resolutionSource,
    });

    const action =
      status === IncidentStatus.Closed
        ? "incident.closed"
        : status === IncidentStatus.FalseReport
          ? "incident.marked_false"
          : "incident.status_changed";
    await this.audit.record({
      actor,
      action,
      entityType: "incidents",
      entityId: id,
      reason: note,
      beforeState: { status: currentStatus, statusVersion: incident.statusVersion },
      afterState: { status, statusVersion: updated.statusVersion },
      metadata: { fromStatus: currentStatus, toStatus: status },
    });

    if (isTerminalIncidentStatus(status)) {
      await this.incidentCommunications
        ?.closeConversationForTerminalIncident(id, note ?? `Incident ${status}`)
        .catch(() => undefined);
    }

    return updated;
  }

  async assign(id: string, dto: { agencyId?: string; adminId?: string; reason?: string }, actor?: JwtPayload) {
    if (actor?.role === AdminRoleName.OversightAuditor) throw new ForbiddenException("Oversight Auditor cannot modify incidents");
    const incident = await this.get(id, actor);
    const currentStatus = incident.status as IncidentStatus;
    const nextStatus = IncidentStatus.Assigned;
    if (currentStatus !== nextStatus && !canTransitionIncident(currentStatus, nextStatus)) {
      throw new BadRequestException(`Incident cannot move from ${currentStatus} to ${nextStatus}`);
    }

    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        assignedAgencyId: dto.agencyId,
        assignedAdminId: dto.adminId,
        ...(currentStatus !== nextStatus ? { status: nextStatus as never } : {}),
        timeline: {
          create: {
            actorId: actor?.typ === "user" ? actor.sub : undefined,
            actorType: actor?.typ ?? "system",
            eventType: "incident.assigned",
            message: dto.reason ?? "Incident assigned.",
            metadata: { agencyId: dto.agencyId, adminId: dto.adminId },
          },
        },
        ...(currentStatus !== nextStatus
          ? {
              statusHistory: {
                create: {
                  fromStatus: currentStatus as never,
                  toStatus: nextStatus as never,
                  note: dto.reason ?? "Incident assigned.",
                },
              },
            }
          : {}),
      } as never,
    });
    await this.audit.record({
      actor,
      action: "incident.assigned",
      entityType: "incidents",
      entityId: id,
      reason: dto.reason,
      beforeState: { assignedAgencyId: incident.assignedAgencyId, assignedAdminId: incident.assignedAdminId, status: incident.status },
      afterState: { assignedAgencyId: dto.agencyId, assignedAdminId: dto.adminId, status: currentStatus !== nextStatus ? nextStatus : currentStatus },
    });
    return updated;
  }

  async recordLocation(id: string, dto: UpdateIncidentLocationDto, actor?: JwtPayload) {
    validateIncidentLocationDto(dto);
    try {
      const data = await this.locationTracking.persistIncidentLocation(id, dto, actor);
      return { data, persisted: true, retryQueued: false };
    } catch (error) {
      if (!isIncidentLocationPersistenceError(error)) {
        throw error;
      }

      const incident = await this.prisma.incident.findUnique({ where: { id } });
      const idempotencyKey = `${id}:${dto.sequenceNumber ?? 0}`;
      const retry = await this.locationRetry.scheduleRetry({
        incidentId: id,
        dto,
        reporterId: actor?.typ === "user" ? actor.sub : incident?.reporterId ?? undefined,
        idempotencyKey,
      });

      if (retry.accepted) {
        void runNonCriticalWrite(
          "incident.location.retry_scheduled",
          { incidentId: id, intake: "standard" },
          async () => {
            await this.prisma.incidentTimeline.create({
              data: {
                incidentId: id,
                actorId: actor?.typ === "user" ? actor.sub : undefined,
                actorType: actor?.typ ?? "system",
                eventType: "incident.location.retry_scheduled",
                message: "Citizen location update failed and was queued for retry.",
                metadata: {
                  sequenceNumber: dto.sequenceNumber ?? 0,
                  source: dto.source,
                  quality: dto.quality,
                  retryId: retry.retryId,
                },
              } as never,
            });
          },
          [],
        );

        throw new HttpException(
          {
            persisted: false,
            retryQueued: true,
            retryId: retry.retryId,
            code: "ERR-INC-LOCATION-RETRY",
            message:
              "Your emergency and video are active. The server accepted this location for retry.",
            incidentId: id,
            locationStatus: "retrying",
          },
          HttpStatus.ACCEPTED,
        );
      }

      throw new ServiceUnavailableException({
        persisted: false,
        retryQueued: false,
        errorCode: "LOCATION-RETRY-001",
        code: "LOCATION-PERSIST-001",
        message:
          "Your emergency and video are active. The server could not save this location. Your device will try again.",
        incidentId: id,
        locationStatus: "device_retry",
      });
    }
  }

  async getLiveLocation(id: string, actor?: JwtPayload) {
    return this.locationTracking.getCitizenLiveLocation(id, actor);
  }

  async getLocationHistory(id: string, actor: JwtPayload | undefined, limit?: string, cursor?: string) {
    return this.locationTracking.getCitizenLocationHistory(id, actor, limit ? Number(limit) : 50, cursor);
  }

  async getTimeline(id: string, actor?: JwtPayload) {
    await this.get(id, actor);
    const audience = actor?.typ === "user" ? "citizen" : actor?.typ === "admin" ? "dispatcher" : "citizen";
    return this.incidentTimeline.buildTimeline(id, audience, actor);
  }

  async cancelEmergency(
    id: string,
    reason: string,
    actor?: JwtPayload,
    structured?: { reasonCode?: string; reasonText?: string | null },
  ) {
    if (!reason?.trim()) throw new BadRequestException("Cancellation reason is required");
    const incident = await this.get(id, actor);
    if (actor?.typ === "user" && incident.reporterId !== actor.sub) {
      throw new ForbiddenException("Only the reporting citizen can cancel this emergency");
    }

    const currentStatus = incident.status as IncidentStatus;
    if (currentStatus === IncidentStatus.CancelledByReporter) {
      return {
        ...incident,
        ...buildIncidentPresentation(incident as Parameters<typeof buildIncidentPresentation>[0], actor),
        duplicate: true,
      };
    }
    if (!canReporterCancelDirectly(currentStatus)) {
      if (canReporterRequestCancellation(currentStatus)) {
        throw new BadRequestException(
          `Incident in status ${currentStatus} requires a cancellation request rather than direct cancellation`,
        );
      }
      throw new BadRequestException(`Incident in status ${currentStatus} cannot be cancelled`);
    }

    const updated = await this.transitionIncidentStatus(id, incident, IncidentStatus.CancelledByReporter, {
      note: reason,
      actor,
      cancellationReason: reason,
      timelineEventType: "incident.cancelled_by_reporter",
    });

    await this.audit.record({
      actor,
      action: "incident.cancelled_by_reporter",
      entityType: "incidents",
      entityId: id,
      reason,
      beforeState: { status: currentStatus, statusVersion: incident.statusVersion },
      afterState: { status: IncidentStatus.CancelledByReporter, statusVersion: updated.statusVersion },
      metadata: {
        fromStatus: currentStatus,
        toStatus: IncidentStatus.CancelledByReporter,
        reasonCode: structured?.reasonCode,
        reasonText: structured?.reasonText,
      },
    });

    if (incident.reporterId) {
      void this.notifications
        .enqueue({
          userId: incident.reporterId,
          incidentId: id,
          title: "Emergency cancelled",
          body: "Your emergency report was cancelled and remains in your history.",
        })
        .catch(() => undefined);
    }

    return updated;
  }

  async requestCancellation(
    id: string,
    reason: string,
    actor?: JwtPayload,
    structured?: { reasonCode?: string; reasonText?: string | null },
  ) {
    if (!reason?.trim()) throw new BadRequestException("Cancellation reason is required");
    const incident = await this.get(id, actor);
    if (actor?.typ === "user" && incident.reporterId !== actor.sub) {
      throw new ForbiddenException("Only the reporting citizen can request cancellation");
    }

    const currentStatus = incident.status as IncidentStatus;
    if (incident.cancellationRequestedAt || currentStatus === IncidentStatus.CancellationRequested) {
      throw new BadRequestException("Cancellation has already been requested for this incident");
    }
    if (!canReporterRequestCancellation(currentStatus)) {
      throw new BadRequestException(`Incident in status ${currentStatus} cannot request cancellation`);
    }

    const updated = await this.transitionIncidentStatus(id, incident, IncidentStatus.CancellationRequested, {
      note: reason,
      actor,
      cancellationReason: reason,
      timelineEventType: "incident.cancellation_requested",
    });

    await this.audit.record({
      actor,
      action: "incident.cancellation_requested",
      entityType: "incidents",
      entityId: id,
      reason,
      beforeState: { status: currentStatus, statusVersion: incident.statusVersion },
      afterState: { status: IncidentStatus.CancellationRequested, statusVersion: updated.statusVersion },
      metadata: {
        fromStatus: currentStatus,
        toStatus: IncidentStatus.CancellationRequested,
        reasonCode: structured?.reasonCode,
        reasonText: structured?.reasonText,
      },
    });

    return updated;
  }

  async submitReporterStatus(
    id: string,
    body: { status: "Resolved" | "StillOngoing" | "Unsure"; note?: string; clientActionId: string },
    actor?: JwtPayload,
  ) {
    if (!body.clientActionId?.trim()) {
      throw new BadRequestException("clientActionId is required");
    }
    const allowedStatuses = new Set(["Resolved", "StillOngoing", "Unsure"]);
    if (!allowedStatuses.has(body.status)) {
      throw new BadRequestException(`Invalid reporter status ${body.status}`);
    }

    const incident = await this.get(id, actor);
    if (actor?.typ === "user" && incident.reporterId !== actor.sub) {
      throw new ForbiddenException("Only the reporting citizen can update reporter status");
    }

    const currentStatus = incident.status as IncidentStatus;
    if (isTerminalIncidentStatus(currentStatus)) {
      throw new BadRequestException(`Incident in status ${currentStatus} cannot accept reporter status updates`);
    }

    const metadata = (incident.metadata ?? {}) as Record<string, unknown>;
    const priorActions =
      (metadata.reporterStatusActions as Record<string, unknown> | undefined) ?? {};
    if (priorActions[body.clientActionId]) {
      return incident;
    }

    const activeAssignment = await this.prisma.incidentAssignment.findFirst({
      where: {
        incidentId: id,
        status: {
          notIn: ["Completed", "Cancelled", "Declined", "Reassigned"] as never,
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const hasActiveAssignment = activeAssignment != null;

    const now = new Date();
    const actionRecord = {
      status: body.status,
      note: body.note ?? null,
      recordedAt: now.toISOString(),
    };

    if (body.status === "Resolved") {
      const canDirectResolve =
        !hasActiveAssignment &&
        (currentStatus === IncidentStatus.Verified ||
          currentStatus === IncidentStatus.Verifying ||
          currentStatus === IncidentStatus.Received ||
          currentStatus === IncidentStatus.Submitted);

      if (canDirectResolve && canTransitionIncident(currentStatus, IncidentStatus.Resolved)) {
        const updated = await this.transitionIncidentStatus(id, incident, IncidentStatus.Resolved, {
          note: body.note,
          actor,
          resolutionSource: ResolutionSource.Reporter,
          timelineEventType: "incident.reporter_confirmed_resolved",
        });
        await this.audit.record({
          actor,
          action: "incident.reporter_confirmed_resolved",
          entityType: "incidents",
          entityId: id,
          reason: body.note,
          beforeState: { status: currentStatus, statusVersion: incident.statusVersion },
          afterState: { status: IncidentStatus.Resolved, statusVersion: updated.statusVersion },
          metadata: { clientActionId: body.clientActionId, reporterStatus: body.status },
        });
        await this.prisma.incident.update({
          where: { id },
          data: {
            metadata: {
              ...metadata,
              reporterStatusActions: { ...priorActions, [body.clientActionId]: actionRecord },
            },
          } as never,
        });
        return updated;
      }

      const updated = await this.prisma.incident.update({
        where: { id },
        data: {
          lastTrustedUpdateAt: now,
          statusVersion: { increment: 1 },
          metadata: {
            ...metadata,
            reporterResolutionSignal: actionRecord,
            reporterStatusActions: { ...priorActions, [body.clientActionId]: actionRecord },
          },
          timeline: {
            create: {
              actorId: actor?.sub,
              actorType: actor?.typ ?? "user",
              eventType: "incident.reporter_resolution_signal",
              message: body.note ?? "Reporter indicated the situation appears resolved.",
              metadata: {
                reporterStatus: body.status,
                clientActionId: body.clientActionId,
                requiresDispatcherReview: hasActiveAssignment,
              },
            },
          },
        } as never,
      });
      await this.audit.record({
        actor,
        action: "incident.reporter_resolution_signal",
        entityType: "incidents",
        entityId: id,
        reason: body.note,
        beforeState: { status: currentStatus, statusVersion: incident.statusVersion },
        afterState: { status: currentStatus, statusVersion: updated.statusVersion },
        metadata: { clientActionId: body.clientActionId, reporterStatus: body.status },
      });
      return updated;
    }

    const eventType =
      body.status === "StillOngoing"
        ? "incident.reporter_still_ongoing"
        : "incident.reporter_unsure";

    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        lastTrustedUpdateAt: now,
        statusVersion: { increment: 1 },
        metadata: {
          ...metadata,
          reporterStatusActions: { ...priorActions, [body.clientActionId]: actionRecord },
        },
        timeline: {
          create: {
            actorId: actor?.sub,
            actorType: actor?.typ ?? "user",
            eventType,
            message:
              body.note ??
              (body.status === "StillOngoing"
                ? "Reporter confirmed the situation is still ongoing."
                : "Reporter is unsure whether the situation is resolved."),
            metadata: { reporterStatus: body.status, clientActionId: body.clientActionId },
          },
        },
      } as never,
    });

    await this.audit.record({
      actor,
      action: eventType,
      entityType: "incidents",
      entityId: id,
      reason: body.note,
      beforeState: { status: currentStatus, statusVersion: incident.statusVersion },
      afterState: { status: currentStatus, statusVersion: updated.statusVersion },
      metadata: { clientActionId: body.clientActionId, reporterStatus: body.status },
    });

    return updated;
  }

  async accessMedia(incidentId: string, mediaId: string, action: "view" | "download", actor?: JwtPayload) {
    await this.get(incidentId, actor);
    const media = await this.prisma.incidentMedia.findFirst({ where: { id: mediaId, incidentId } });
    if (!media) throw new NotFoundException("Incident evidence not found");
    await this.prisma.incidentMediaAccessLog.create({
      data: {
        mediaId,
        accessorId: actor?.typ === "user" ? actor.sub : undefined,
        adminUserId: actor?.typ === "admin" ? actor.sub : undefined,
        action,
        reason: action === "download" ? "Evidence downloaded for investigation" : "Evidence viewed",
      } as never,
    });
    await this.audit.record({
      actor,
      action: action === "download" ? "evidence.downloaded" : "evidence.viewed",
      entityType: "incident_media",
      entityId: mediaId,
      reason: action === "download" ? "Evidence downloaded for investigation" : "Evidence viewed",
      metadata: { incidentId, fileHash: media.fileHash, objectKey: media.objectKey },
    });

    let signedUrl: string | undefined;
    try {
      signedUrl = (await createStorageDownloadUrl(media.objectKey, 300)).url;
    } catch {
      signedUrl = undefined;
    }

    return {
      data: media,
      access: action,
      signedUrl,
      expiresInSeconds: signedUrl ? 300 : undefined,
    };
  }

  async diagnoseJurisdiction(latitude: number, longitude: number, actor?: JwtPayload) {
    return this.jurisdictionResolution.diagnose(latitude, longitude, actor);
  }

  private buildReportResponse(
    incident: { id: string; status: unknown; priority: unknown; submittedAt: Date },
    emergencyFastPath: boolean,
    duplicate: boolean,
    nonCriticalWarnings: string[] = [],
  ) {
    return {
      id: incident.id,
      status: incident.status,
      priority: incident.priority,
      submittedAt: incident.submittedAt,
      fastPath: emergencyFastPath,
      duplicate,
      targetProcessingTimeMs: emergencyFastPath ? 3000 : undefined,
      ...(nonCriticalWarnings.length ? { nonCriticalWarnings } : {}),
    };
  }

  private async attachInitialMedia(incidentId: string, mediaItems: NonNullable<ReportIncidentDto["media"]>, actor: JwtPayload | undefined, isAnonymous: boolean, fallbackLatitude: number, fallbackLongitude: number) {
    const uploaderId = !isAnonymous && actor?.typ === "user" ? actor.sub : await this.systemUserId();

    for (const media of mediaItems) {
      validateMediaDraft(media);
      assertEvidenceObjectKey(incidentId, media.objectKey, media.bucket, media.contentType);
      const created = await (this.prisma as any).incidentMedia.create({
        data: {
          incidentId,
          uploaderId,
          mediaType: media.mediaType as never,
          bucket: media.bucket,
          objectKey: media.objectKey,
          contentType: media.contentType,
          sizeBytes: media.sizeBytes == null ? undefined : BigInt(media.sizeBytes),
          fileHash: media.fileHash,
          capturedAt: media.capturedAt ? new Date(media.capturedAt) : new Date(),
          latitude: media.latitude ?? fallbackLatitude,
          longitude: media.longitude ?? fallbackLongitude,
          metadata: media.metadata ?? {},
          durationSeconds: media.durationSeconds,
          selectedLanguage: media.selectedLanguage,
          clientAttachmentId: media.clientAttachmentId,
          transcriptionStatus: media.mediaType === "Audio" ? "Uploaded" : undefined,
          moderationStatus: media.mediaType === "Audio" ? "Pending" : undefined,
        } as never,
      });
      if (media.mediaType === "Audio") {
        void this.voiceTranscription.enqueueIncidentMediaTranscription(created.id).catch(() => undefined);
      }
    }

    await this.prisma.incidentTimeline.create({
      data: {
        incidentId,
        actorId: !isAnonymous && actor?.typ === "user" ? actor.sub : undefined,
        actorType: isAnonymous ? "anonymous" : actor?.typ ?? "system",
        eventType: "incident.media_batch_attached",
        message: `${mediaItems.length} evidence file(s) attached at submission.`,
      },
    });
  }

  private async createMissingPersonReport(incidentId: string, dto: ReportIncidentDto, actor?: JwtPayload) {
    const missing = dto.missingPerson!;
    await this.prisma.missingPersonReport.create({
      data: {
        reporterId: dto.anonymous ? undefined : actor?.typ === "user" ? actor.sub : undefined,
        incidentId,
        fullName: missing.fullName,
        age: missing.age,
        gender: missing.gender,
        description: missing.description ?? dto.description,
        lastSeenAt: missing.lastSeenAt ? new Date(missing.lastSeenAt) : undefined,
        lastSeenAddress: missing.lastSeenAddress ?? dto.manualAddress ?? dto.address,
        latitude: dto.manualLatitude ?? dto.latitude,
        longitude: dto.manualLongitude ?? dto.longitude,
      } as never,
    });
  }

  private async createStolenVehicleReport(incidentId: string, dto: ReportIncidentDto, actor?: JwtPayload) {
    const vehicle = dto.stolenVehicle!;
    const storedVehicle = await this.prisma.vehicle.upsert({
      where: { plateNumber: vehicle.plateNumber },
      update: { vin: vehicle.vin, make: vehicle.make, model: vehicle.model, color: vehicle.color, year: vehicle.year },
      create: {
        ownerId: dto.anonymous ? undefined : actor?.typ === "user" ? actor.sub : undefined,
        plateNumber: vehicle.plateNumber,
        vin: vehicle.vin,
        make: vehicle.make,
        model: vehicle.model,
        color: vehicle.color,
        year: vehicle.year,
      },
    });

    await this.prisma.stolenVehicleReport.create({
      data: {
        vehicleId: storedVehicle.id,
        reporterId: dto.anonymous ? undefined : actor?.typ === "user" ? actor.sub : undefined,
        incidentId,
        lastSeenAt: vehicle.lastSeenAt ? new Date(vehicle.lastSeenAt) : undefined,
        lastSeenArea: vehicle.lastSeenArea ?? dto.manualAddress ?? dto.address,
        latitude: dto.manualLatitude ?? dto.latitude,
        longitude: dto.manualLongitude ?? dto.longitude,
      } as never,
    });
  }

  private async createEmergencyContactNotifications(userId: string, incidentId: string, title: string, contactIds?: string[]) {
    const where = contactIds?.length
      ? { userId, id: { in: contactIds } }
      : { userId };
    const contacts = await this.prisma.emergencyContact.findMany({ where, orderBy: { priority: "asc" }, take: 5 });
    if (!contacts.length) return;

    await Promise.all(
      contacts.map((contact) =>
        this.notifications.enqueue({
          channel: "sms",
          phone: contact.phone,
          title: "THE EYE emergency report",
          body: `${contact.name}, an emergency report was submitted: ${title}. Open THE EYE for updates.`,
          incidentId,
        }),
      ),
    );
  }

  private async buildIncidentMediaCreateData(
    incidentId: string,
    dto: ConfirmIncidentMediaDto,
    actor?: JwtPayload,
  ) {
    const uploaderId = actor?.typ === "user" ? actor.sub : await this.systemUserId();
    return {
      incidentId,
      uploaderId,
      mediaType: dto.mediaType as never,
      bucket: dto.bucket,
      objectKey: dto.objectKey,
      contentType: dto.contentType,
      sizeBytes: dto.sizeBytes == null ? undefined : BigInt(dto.sizeBytes),
      fileHash: dto.fileHash,
      capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : new Date(),
      latitude: dto.latitude ?? 0,
      longitude: dto.longitude ?? 0,
      metadata: dto.metadata ?? {},
      durationSeconds: dto.durationSeconds,
      selectedLanguage: dto.selectedLanguage,
      clientAttachmentId: dto.clientAttachmentId,
      transcriptionStatus: dto.mediaType === "Audio" ? "Uploaded" : undefined,
      moderationStatus: dto.mediaType === "Audio" ? "Pending" : undefined,
    } as never;
  }

  private toIncidentMediaResponse(media: any) {
    return {
      ...media,
      sizeBytes: media.sizeBytes == null ? null : Number(media.sizeBytes),
      latitude: media.latitude == null ? null : Number(media.latitude),
      longitude: media.longitude == null ? null : Number(media.longitude),
    };
  }

  private async systemUserId() {
    const user = await this.prisma.user.upsert({
      where: { email: "system@theeye.local" },
      update: {},
      create: { email: "system@theeye.local", passwordHash: hashPassword(randomToken()) },
    });
    return user.id;
  }

  private defaultTitle(type: IncidentType) {
    return `${type} report`;
  }

  private defaultPriority(type: IncidentType) {
    if ([IncidentType.Emergency, IncidentType.Fire, IncidentType.Kidnapping].includes(type)) return IncidentPriority.P1LifeThreatening;
    if ([IncidentType.Crime, IncidentType.Accident, IncidentType.Abuse].includes(type)) return IncidentPriority.P2ActiveCrimeAccident;
    if (type === IncidentType.SuspiciousActivity) return IncidentPriority.P3SuspiciousActivity;
    return IncidentPriority.P4GeneralSafety;
  }

  private incidentScopeWhere(actor?: JwtPayload) {
    if (!actor) return { id: "__deny_all__" };
    if (actor.typ === "user") return { reporterId: actor.sub };
    if (actor.role === AdminRoleName.SuperAdmin) return {};
    if (actor.role === AdminRoleName.CountryAdmin) return { country: actor.country };
    if (actor.role === AdminRoleName.StateAdmin) return { country: actor.country, state: actor.state };
    if (actor.role === AdminRoleName.LgaAdmin || actor.role === AdminRoleName.CallCenterAgent || actor.role === AdminRoleName.OversightAuditor) return { country: actor.country, state: actor.state, lga: actor.lga };
    if (actor.role === AdminRoleName.AgencyAdmin || actor.role === AdminRoleName.PoliceSecurityOfficer) return { assignedAgencyId: actor.agencyId ?? "__no_agency__" };
    return { id: "__deny_all__" };
  }

  private inferResolutionSource(actor?: JwtPayload): ResolutionSource {
    if (actor?.typ === "user") return ResolutionSource.Reporter;
    if (actor?.role === AdminRoleName.CallCenterAgent) return ResolutionSource.Dispatcher;
    if (actor?.typ === "admin") return ResolutionSource.Administrator;
    return ResolutionSource.Agency;
  }

  private async transitionIncidentStatus(
    id: string,
    incident: { status: unknown; statusVersion?: number },
    nextStatus: IncidentStatus,
    options: {
      note?: string;
      actor?: JwtPayload;
      cancellationReason?: string;
      resolutionSource?: ResolutionSource;
      timelineEventType?: string;
    },
  ) {
    const currentStatus = incident.status as IncidentStatus;
    const now = new Date();
    const data: Record<string, unknown> = {
      status: nextStatus,
      statusVersion: { increment: 1 },
      lastTrustedUpdateAt: now,
      timeline: {
        create: {
          actorId: options.actor?.typ === "user" ? options.actor.sub : undefined,
          actorType: options.actor?.typ ?? "system",
          eventType: options.timelineEventType ?? "incident.status_changed",
          message: options.note ?? `Status changed from ${currentStatus} to ${nextStatus}`,
          metadata: { fromStatus: currentStatus, toStatus: nextStatus },
        },
      },
      statusHistory: {
        create: {
          fromStatus: currentStatus as never,
          toStatus: nextStatus as never,
          changedById: options.actor?.sub,
          note: options.note ?? `Status changed from ${currentStatus} to ${nextStatus}`,
        },
      },
    };

    if (nextStatus === IncidentStatus.Resolved) {
      data.resolvedAt = now;
      data.resolutionReason = options.note;
      data.resolvedById = options.actor?.sub;
      data.resolutionSource = options.resolutionSource ?? this.inferResolutionSource(options.actor);
    }
    if (nextStatus === IncidentStatus.Closed) {
      data.closedAt = now;
      data.closureReviewAt = now;
    }
    if (nextStatus === IncidentStatus.CancelledByReporter) {
      data.cancelledAt = now;
      data.cancelledById = options.actor?.sub;
      data.cancellationReason = options.cancellationReason ?? options.note;
    }
    if (nextStatus === IncidentStatus.CancellationRequested) {
      data.cancellationRequestedAt = now;
      data.cancellationRequestedById = options.actor?.sub;
      data.cancellationReason = options.cancellationReason ?? options.note;
    }
    if (nextStatus === IncidentStatus.ExpiredAfterReview) {
      data.closureReviewAt = now;
    }

    return this.prisma.incident.update({ where: { id }, data: data as never });
  }
}

function evidenceTimelineMessage(mediaType: string): string {
  switch (mediaType) {
    case "Image":
      return "Reporter uploaded a photo.";
    case "Video":
      return "Reporter uploaded a video.";
    case "Audio":
      return "Reporter added a voice update.";
    default:
      return "Reporter uploaded evidence.";
  }
}



