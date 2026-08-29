import { ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AdminRoleName, IncidentStatus, IncidentType, ResolutionSource } from "@the-eye/shared";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import type { JwtPayload } from "../../common/auth/jwt";
import { MetricsService } from "../../common/metrics/metrics.service";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { LinkLiveVideoEvidenceDto, LiveVideoLocationUpdateDto, StartLiveVideoDto, validateEvidenceLink, validateLocationUpdate } from "./dto/live-video.dto";
import { buildLiveVideoConnectionDto } from "./live-video-connection.dto";
import { buildLiveVideoConnectionDiagnostics, decodeJwtExpiryIso } from "./live-video-diagnostics";
import { LiveVideoErrorCode, liveVideoErrorBody } from "./live-video.errors";
import { LiveKitTokenService } from "./livekit-token.service";

const LIVE_EMERGENCY_ACTIVE_STATUSES = new Set<IncidentStatus>([
  IncidentStatus.Submitted,
  IncidentStatus.Received,
  IncidentStatus.Verifying,
  IncidentStatus.Verified,
  IncidentStatus.Assigned,
  IncidentStatus.Responding,
  IncidentStatus.UnderControl,
  IncidentStatus.CancellationRequested,
]);

@Injectable()
export class LiveVideoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly livekitTokens: LiveKitTokenService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
    private readonly metrics: MetricsService,
  ) {}

  async startFieldBroadcastLiveVideo(
    broadcastId: string,
    dto: StartLiveVideoDto,
    actor: JwtPayload,
    trace: { requestId?: string; clientTraceId?: string } = {},
  ) {
    if (actor.typ !== "field") {
      throw new ForbiddenException(
        liveVideoErrorBody(LiveVideoErrorCode.NOT_AUTHORIZED, "Field session required", trace.requestId),
      );
    }
    validateLocationUpdate(dto);
    const broadcast = await this.prisma.broadcast.findUnique({ where: { id: broadcastId } });
    if (!broadcast) throw new NotFoundException("Broadcast not found");
    if (broadcast.creatorAdminId !== actor.sub) {
      throw new ForbiddenException(
        liveVideoErrorBody(
          LiveVideoErrorCode.NOT_AUTHORIZED,
          "Only the submitting field officer can start this live video",
          trace.requestId,
        ),
      );
    }
    if (!broadcast.jurisdictionId || !broadcast.country || !broadcast.state || !broadcast.lga) {
      throw new ForbiddenException("Broadcast jurisdiction is incomplete");
    }

    let incidentId = broadcast.incidentId;
    if (!incidentId) {
      const incidentType = this.incidentTypeForBroadcast(String(broadcast.type));
      const incident = await this.prisma.incident.create({
        data: {
          reporterId: null,
          jurisdictionId: broadcast.jurisdictionId,
          assignedAdminId: actor.sub,
          type: incidentType as never,
          status: IncidentStatus.Submitted as never,
          priority: broadcast.priority,
          title: broadcast.title,
          description: broadcast.body,
          country: broadcast.country,
          state: broadcast.state,
          lga: broadcast.lga,
          latitude: dto.latitude,
          longitude: dto.longitude,
          metadata: {
            source: "field_broadcast_live_video",
            broadcastId,
            fieldDeviceId: actor.fieldDeviceId ?? null,
          },
        } as never,
      });
      const linked = await this.prisma.broadcast.updateMany({
        where: { id: broadcastId, incidentId: null },
        data: { incidentId: incident.id },
      });
      if (linked.count === 0) {
        await this.prisma.incident.delete({ where: { id: incident.id } });
        const current = await this.prisma.broadcast.findUnique({ where: { id: broadcastId } });
        incidentId = current?.incidentId ?? null;
      } else {
        incidentId = incident.id;
      }
    }
    if (!incidentId) throw new InternalServerErrorException("Unable to link live video incident");
    return this.startIncidentLiveVideo(incidentId, dto, actor, trace);
  }

  async startIncidentLiveVideo(
    incidentId: string,
    dto: StartLiveVideoDto,
    actor: JwtPayload,
    trace: { requestId?: string; clientTraceId?: string } = {},
  ) {
    const startedAt = Date.now();
    const logContext = {
      scope: "live_video.start",
      incidentId,
      requestId: trace.requestId,
      clientTraceId: trace.clientTraceId,
    };
    if (actor.typ !== "user" && actor.typ !== "field") {
      throw new ForbiddenException(
        liveVideoErrorBody(
          LiveVideoErrorCode.NOT_AUTHORIZED,
          "Only citizens or authorized field sessions can start live video",
          trace.requestId,
        ),
      );
    }
    validateLocationUpdate(dto);
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) {
      throw new NotFoundException(
        liveVideoErrorBody(
          LiveVideoErrorCode.INCIDENT_UNAVAILABLE,
          "Incident not found",
          trace.requestId,
        ),
      );
    }
    if (actor.typ === "user" && incident.reporterId && incident.reporterId !== actor.sub) {
      throw new ForbiddenException(
        liveVideoErrorBody(
          LiveVideoErrorCode.NOT_AUTHORIZED,
          "Only the reporting user can start live video for this incident",
          trace.requestId,
        ),
      );
    }
    if (actor.typ === "field" && incident.assignedAdminId !== actor.sub) {
      throw new ForbiddenException(
        liveVideoErrorBody(
          LiveVideoErrorCode.NOT_AUTHORIZED,
          "Only the assigned field officer can start live video for this incident",
          trace.requestId,
        ),
      );
    }

    const incidentMetadata =
      typeof incident.metadata === "object" && incident.metadata && !Array.isArray(incident.metadata)
        ? (incident.metadata as Record<string, unknown>)
        : {};
    if (dto.standaloneEmergency === true) {
      const isOwnedLiveEmergency =
        actor.typ === "user" &&
        incident.reporterId === actor.sub &&
        incident.type === IncidentType.Emergency &&
        incident.title.trim().toLowerCase() === "live emergency video";
      if (!isOwnedLiveEmergency) {
        throw new ForbiddenException(
          liveVideoErrorBody(
            LiveVideoErrorCode.NOT_AUTHORIZED,
            "Standalone live emergency may only finalize its originating incident",
            trace.requestId,
          ),
        );
      }
      await this.prisma.incident.update({
        where: { id: incidentId },
        data: {
          metadata: {
            ...incidentMetadata,
            source: "live_emergency_video",
            standaloneLiveEmergency: true,
          },
        } as never,
      });
    }
    const standaloneLiveEmergency =
      dto.standaloneEmergency === true ||
      incidentMetadata.standaloneLiveEmergency === true ||
      incidentMetadata.source === "live_emergency_video";

    try {
      this.livekitTokens.assertLiveKitConfigured({ requireWss: true });
    } catch (error) {
      const mapped = this.livekitTokens.mapConfigurationError(error);
      throw new InternalServerErrorException(
        liveVideoErrorBody(
          mapped.code as (typeof LiveVideoErrorCode)[keyof typeof LiveVideoErrorCode],
          mapped.message,
          trace.requestId,
        ),
      );
    }

    const roomName = `eye-incident-${incidentId}`;
    const identity = `${actor.typ}-${actor.sub}`;
    let session;
    try {
      session = await this.prisma.liveVideoSession.upsert({
        where: { roomName },
        update: {
          status: "Active",
          endedAt: null,
          startedAt: new Date(),
          createdById: actor.sub,
          lowBandwidthMode: dto.lowBandwidthMode ?? false,
          participantIdentity: identity,
          metadata: {
            lowBandwidthMode: dto.lowBandwidthMode ?? false,
            role: "publisher",
            standaloneLiveEmergency,
          },
        } as never,
        create: {
          incidentId,
          roomName,
          livekitRoomId: roomName,
          createdById: actor.sub,
          status: "Active",
          lowBandwidthMode: dto.lowBandwidthMode ?? false,
          participantIdentity: identity,
          startedAt: new Date(),
          metadata: {
            lowBandwidthMode: dto.lowBandwidthMode ?? false,
            role: "publisher",
            standaloneLiveEmergency,
          },
        } as never,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        liveVideoErrorBody(
          LiveVideoErrorCode.SESSION_PERSIST_FAILED,
          "Live video session could not be saved",
          trace.requestId,
          { cause: message.slice(0, 240) },
        ),
      );
    }

    await this.timeline(incidentId, actor, "live_video.started", dto.lowBandwidthMode ? "Emergency live video started in low-bandwidth mode." : "Emergency live video started.", { sessionId: session.id, roomName });

    let location: Awaited<ReturnType<LiveVideoService["createLocationUpdate"]>> | null = null;
    let locationPersistDegraded = false;
    if (dto.latitude != null && dto.longitude != null) {
      try {
        location = await this.createLocationUpdate(session.id, incidentId, dto as LiveVideoLocationUpdateDto);
      } catch (error) {
        locationPersistDegraded = true;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          JSON.stringify({
            level: "warn",
            ...logContext,
            code: LiveVideoErrorCode.LOCATION_PERSIST_DEGRADED,
            sessionId: session.id,
            message: message.slice(0, 240),
          }),
        );
      }
    }

    await this.audit(actor, "live_video.started", session.id, {
      incidentId,
      roomName,
      lowBandwidthMode: dto.lowBandwidthMode ?? false,
      locationPersistDegraded,
    });

    let token: string;
    let clientUrl: string;
    try {
      clientUrl = this.livekitTokens.clientLivekitUrl({ requireWss: true });
    } catch (error) {
      const mapped = this.livekitTokens.mapConfigurationError(error);
      throw new InternalServerErrorException(
        liveVideoErrorBody(
          mapped.code as (typeof LiveVideoErrorCode)[keyof typeof LiveVideoErrorCode],
          mapped.message,
          trace.requestId,
        ),
      );
    }
    try {
      console.log(
        JSON.stringify({
          level: "info",
          scope: "live_video.token_generation",
          incidentId,
          sessionId: session.id,
          roomName,
          participantIdentity: identity,
          correlationId: trace.clientTraceId || trace.requestId || session.id,
          status: "started",
        }),
      );
      token = this.livekitTokens.createToken({
        identity,
        name: actor.typ === "field" ? "Field operations live video" : "Citizen emergency video",
        roomName,
        canPublish: true,
        canSubscribe: false,
        lowBandwidthMode: dto.lowBandwidthMode,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        liveVideoErrorBody(
          LiveVideoErrorCode.TOKEN_GENERATION_FAILED,
          "LiveKit access token could not be issued",
          trace.requestId,
          { cause: message.slice(0, 240) },
        ),
      );
    }

    const tokenExpiresAt = decodeJwtExpiryIso(token);
    const correlationId = String(trace.clientTraceId || trace.requestId || randomUUID());
    const connection = buildLiveVideoConnectionDto({
      serverUrl: clientUrl,
      participantToken: token,
      participantIdentity: identity,
      roomName,
      expiresAt: tokenExpiresAt,
    });

    if (
      !connection.serverUrl ||
      !connection.participantToken ||
      !connection.roomName ||
      !connection.participantIdentity
    ) {
      throw new InternalServerErrorException(
        liveVideoErrorBody(
          LiveVideoErrorCode.TOKEN_CONNECTION_INCOMPLETE,
          "Live video connection details could not be constructed",
          trace.requestId,
          { correlationId },
        ),
      );
    }

    const tokenDiagnostics = buildLiveVideoConnectionDiagnostics({
      serverUrl: clientUrl,
      roomName,
      participantIdentity: identity,
      token,
      apiKey: this.livekitTokens.livekitApiKey(),
    });

    const durationMs = Date.now() - startedAt;
    this.metrics.recordLiveVideoOperation("start", durationMs / 1000, "success");
    console.log(
      JSON.stringify({
        level: "info",
        ...logContext,
        sessionId: session.id,
        roomName,
        correlationId,
        durationMs,
        locationPersistDegraded,
        warningCodes: locationPersistDegraded
          ? [LiveVideoErrorCode.LOCATION_PERSIST_DEGRADED]
          : [],
        tokenGeneration: {
          status: "succeeded",
          roomGrant: roomName,
          participantIdentity: identity,
          ...tokenDiagnostics,
        },
      }),
    );

    return {
      data: {
        ...session,
        latestLocation: location,
        evidenceOverlay: this.evidenceOverlay(incident, session, location),
        ...(locationPersistDegraded
          ? { locationPersistWarning: LiveVideoErrorCode.LOCATION_PERSIST_DEGRADED }
          : {}),
        startupTimingMs: durationMs,
        requestId: trace.requestId,
        clientTraceId: trace.clientTraceId,
        correlationId,
        participantIdentity: identity,
        connection,
      },
      livekit: {
        url: clientUrl,
        roomName,
        token,
      },
      connection,
    };
  }

  async stopIncidentLiveVideo(sessionId: string, actor: JwtPayload) {
    const session = await this.prisma.liveVideoSession.findUnique({ where: { id: sessionId }, include: { incident: true } });
    if (!session) throw new NotFoundException("Live video session not found");
    if (actor.typ === "user" && session.createdById !== actor.sub) throw new ForbiddenException("Only the stream owner can stop this live video");
    if (actor.typ === "field" && session.createdById !== actor.sub) throw new ForbiddenException("Only the stream owner can stop this live video");
    if (actor.typ === "admin") await this.assertAdminCanAccessIncident(session.incidentId, actor);

    const sessionMetadata =
      typeof session.metadata === "object" && session.metadata && !Array.isArray(session.metadata)
        ? (session.metadata as Record<string, unknown>)
        : {};
    const incidentMetadata =
      typeof session.incident.metadata === "object" && session.incident.metadata && !Array.isArray(session.incident.metadata)
        ? (session.incident.metadata as Record<string, unknown>)
        : {};
    const standaloneLiveEmergency =
      actor.typ === "user" &&
      session.incident.reporterId === actor.sub &&
      (sessionMetadata.standaloneLiveEmergency === true ||
        incidentMetadata.standaloneLiveEmergency === true ||
        incidentMetadata.source === "live_emergency_video");
    const currentStatus = session.incident.status as IncidentStatus;
    const incidentAlreadyArchived = !LIVE_EMERGENCY_ACTIVE_STATUSES.has(currentStatus);
    const now = new Date();

    let updated;
    let resultingIncidentStatus = currentStatus;
    if (standaloneLiveEmergency && !incidentAlreadyArchived) {
      const result = await this.prisma.$transaction(async (transaction) => {
        const updatedSession = await transaction.liveVideoSession.update({
          where: { id: sessionId },
          data: { status: "Ended", endedAt: now } as never,
        });
        const updatedIncident = await transaction.incident.update({
          where: { id: session.incidentId },
          data: {
            status: IncidentStatus.Resolved,
            statusVersion: { increment: 1 },
            lastTrustedUpdateAt: now,
            resolvedAt: now,
            resolvedById: actor.sub,
            resolutionSource: ResolutionSource.Reporter,
            resolutionReason: "Standalone live emergency video ended by reporter.",
            timeline: {
              create: {
                actorId: actor.sub,
                actorType: actor.typ,
                eventType: "live_video.emergency_ended",
                message: "Live emergency video ended and moved to archive.",
                metadata: {
                  sessionId,
                  fromStatus: currentStatus,
                  toStatus: IncidentStatus.Resolved,
                },
              },
            },
            statusHistory: {
              create: {
                fromStatus: currentStatus,
                toStatus: IncidentStatus.Resolved,
                changedById: actor.sub,
                note: "Standalone live emergency video ended by reporter.",
              },
            },
          } as never,
        });
        return { updatedSession, updatedIncident };
      });
      updated = result.updatedSession;
      resultingIncidentStatus = result.updatedIncident.status as IncidentStatus;
    } else {
      updated = await this.prisma.liveVideoSession.update({
        where: { id: sessionId },
        data: { status: "Ended", endedAt: now } as never,
      });
      await this.timeline(session.incidentId, actor, "live_video.stopped", "Emergency live video stopped.", {
        sessionId,
      });
    }
    const incidentArchived = standaloneLiveEmergency &&
      (!LIVE_EMERGENCY_ACTIVE_STATUSES.has(resultingIncidentStatus) || incidentAlreadyArchived);
    await this.audit(actor, "live_video.stopped", sessionId, {
      incidentId: session.incidentId,
      standaloneLiveEmergency,
      incidentArchived,
    });
    return {
      data: updated,
      incident: {
        id: session.incidentId,
        status: resultingIncidentStatus,
        archived: incidentArchived,
      },
    };
  }

  private incidentTypeForBroadcast(type: string): IncidentType {
    if (type === "Emergency") return IncidentType.Emergency;
    if (type === "Crime") return IncidentType.Crime;
    if (type === "Accident") return IncidentType.Accident;
    return IncidentType.CommunitySafety;
  }

  /**
   * Citizen client reports that Room.connect / publish failed after token mint.
   * Marks the session Failed so Active Emergency no longer shows "Live".
   */
  async reportClientJoinFailure(
    sessionId: string,
    actor: JwtPayload,
    body: { reasonCode?: string; message?: string; clientTraceId?: string } = {},
  ) {
    const session = await this.prisma.liveVideoSession.findUnique({
      where: { id: sessionId },
      include: { incident: true },
    });
    if (!session) throw new NotFoundException("Live video session not found");
    if (actor.typ !== "user" || session.createdById !== actor.sub) {
      throw new ForbiddenException("Only the stream owner can report join failure");
    }
    if (session.status === "Ended") {
      return { data: session };
    }

    const reasonCode = (body.reasonCode ?? LiveVideoErrorCode.CLIENT_JOIN_FAILED).slice(0, 64);
    const message = (body.message ?? "Client failed to join LiveKit room").slice(0, 480);
    const updated = await this.prisma.liveVideoSession.update({
      where: { id: sessionId },
      data: {
        status: "Failed",
        endedAt: new Date(),
        metadata: {
          ...(typeof session.metadata === "object" && session.metadata && !Array.isArray(session.metadata)
            ? (session.metadata as Record<string, unknown>)
            : {}),
          clientJoinFailure: {
            reasonCode,
            message,
            clientTraceId: body.clientTraceId ?? null,
            at: new Date().toISOString(),
          },
        },
      } as never,
    });
    await this.timeline(
      session.incidentId,
      actor,
      "live_video.join_failed",
      "Emergency live video could not connect. Retry available.",
      { sessionId, reasonCode },
    );
    await this.audit(actor, "live_video.join_failed", sessionId, {
      incidentId: session.incidentId,
      reasonCode,
      clientTraceId: body.clientTraceId ?? null,
    });
    return { data: updated };
  }

  async adminViewToken(sessionId: string, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can view incident live streams");
    const session = await this.prisma.liveVideoSession.findUnique({
      where: { id: sessionId },
      include: {
        incident: { include: { reporter: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
        locationUpdates: { orderBy: { capturedAt: "desc" }, take: 100 },
      },
    });
    if (!session) throw new NotFoundException("Live video session not found");
    if (session.status !== "Active") throw new ForbiddenException("Live video session is not active");
    await this.assertAdminCanAccessIncident(session.incidentId, actor);

    const identity = `admin-${actor.sub}`;
    await this.audit(actor, "live_video.admin_view_token_created", sessionId, { incidentId: session.incidentId });
    return {
      data: { ...session, evidenceOverlay: this.evidenceOverlay(session.incident, session, session.locationUpdates[0]) },
      livekit: {
        url: this.livekitTokens.clientLivekitUrl(),
        roomName: session.roomName,
        token: this.livekitTokens.createToken({ identity, name: actor.email ?? "THE EYE admin", roomName: session.roomName, canPublish: false, canSubscribe: true }),
      },
    };
  }

  async activeSessions(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can list active live streams");
    const sessions = await this.prisma.liveVideoSession.findMany({
      where: { status: "Active" },
      include: {
        incident: { include: { reporter: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
        locationUpdates: { orderBy: { capturedAt: "desc" }, take: 100 },
      },
      orderBy: { startedAt: "desc" },
      take: 100,
    });
    return { data: sessions.filter((session) => this.adminCanAccessIncident(session.incident, actor)) };
  }

  async linkEvidence(sessionId: string, dto: LinkLiveVideoEvidenceDto, actor: JwtPayload) {
    validateEvidenceLink(dto);
    const session = await this.prisma.liveVideoSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException("Live video session not found");
    if (actor.typ === "admin") await this.assertAdminCanAccessIncident(session.incidentId, actor);
    const media = await this.prisma.incidentMedia.findUnique({ where: { id: dto.mediaId } });
    if (!media || media.incidentId !== session.incidentId) throw new NotFoundException("Incident evidence media not found for this session");

    const updated = await this.prisma.liveVideoSession.update({ where: { id: sessionId }, data: { recordingMediaId: dto.mediaId } });
    await this.timeline(session.incidentId, actor, "live_video.evidence_linked", "Live video recording linked to incident evidence.", { sessionId, mediaId: dto.mediaId });
    await this.audit(actor, "live_video.evidence_linked", sessionId, { incidentId: session.incidentId, mediaId: dto.mediaId });
    return { data: updated };
  }

  async addLocationUpdate(sessionId: string, dto: LiveVideoLocationUpdateDto, actor: JwtPayload) {
    const startedAt = Date.now();
    if (actor.typ !== "user") throw new ForbiddenException("Only the citizen stream owner can update live video location");
    validateLocationUpdate(dto);
    const session = await this.prisma.liveVideoSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException("Live video session not found");
    if (session.createdById !== actor.sub) throw new ForbiddenException("Only the stream owner can update this live video location");
    const location = await this.createLocationUpdate(session.id, session.incidentId, dto);
    this.metrics.recordLiveVideoOperation("location_update", (Date.now() - startedAt) / 1000, "success");
    return { data: location, realtime: { event: "live_video.location.updated", sessionId, pollIntervalMs: 5000 } };
  }

  async latestLocation(sessionId: string, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can view live video location");
    const session = await this.prisma.liveVideoSession.findUnique({
      where: { id: sessionId },
      include: {
        incident: { include: { reporter: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
        locationUpdates: { orderBy: { capturedAt: "desc" }, take: 1 },
      },
    });
    if (!session) throw new NotFoundException("Live video session not found");
    await this.assertAdminCanAccessIncident(session.incidentId, actor);
    const latest = session.locationUpdates[0];
    return {
      data: latest,
      evidenceOverlay: this.evidenceOverlay(session.incident, session, latest),
      signedOpenLocationUrl: latest ? `/live-video/sessions/${sessionId}/location/open/${this.signLocationToken(sessionId, actor.sub)}` : null,
      mapLinks: latest ? this.mapLinks(latest.latitude, latest.longitude) : null,
      realtime: { event: "live_video.location.updated", sessionId, pollIntervalMs: 5000 },
    };
  }

  async locationHistory(sessionId: string, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can view live video movement trail");
    const session = await this.prisma.liveVideoSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException("Live video session not found");
    await this.assertAdminCanAccessIncident(session.incidentId, actor);
    return {
      data: await this.prisma.liveVideoLocationUpdate.findMany({
        where: { liveVideoSessionId: sessionId },
        orderBy: { capturedAt: "asc" },
        take: 1000,
      }),
    };
  }

  async openLiveLocation(sessionId: string, token: string, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can open live video location");
    if (!this.verifyLocationToken(sessionId, actor.sub, token)) throw new ForbiddenException("Invalid or expired live location link");
    const session = await this.prisma.liveVideoSession.findUnique({ where: { id: sessionId }, include: { locationUpdates: { orderBy: { capturedAt: "desc" }, take: 1 } } });
    if (!session) throw new NotFoundException("Live video session not found");
    await this.assertAdminCanAccessIncident(session.incidentId, actor);
    const latest = session.locationUpdates[0];
    if (!latest) throw new NotFoundException("Live location is not available yet");
    await this.audit(actor, "live_video.location_opened", sessionId, { incidentId: session.incidentId, latitude: latest.latitude, longitude: latest.longitude });
    return { data: this.mapLinks(latest.latitude, latest.longitude) };
  }

  private async assertAdminCanAccessIncident(incidentId: string, actor: JwtPayload) {
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException("Incident not found");
    if (!this.adminCanAccessIncident(incident, actor)) throw new ForbiddenException("Admin cannot view live streams outside assigned scope");
  }

  private adminCanAccessIncident(
    incident: { country?: string | null; state?: string | null; lga?: string | null; assignedAgencyId?: string | null },
    actor: JwtPayload,
  ) {
    if (actor.role === AdminRoleName.SuperAdmin) return true;
    if (actor.role === AdminRoleName.CountryAdmin) return incident.country === actor.country;
    if (actor.role === AdminRoleName.StateAdmin) return incident.country === actor.country && incident.state === actor.state;
    if (
      actor.role === AdminRoleName.LgaAdmin
      || actor.role === AdminRoleName.CallCenterAgent
      || actor.role === AdminRoleName.OversightAuditor
    ) {
      return incident.country === actor.country && incident.state === actor.state && incident.lga === actor.lga;
    }
    if (actor.role === AdminRoleName.AgencyAdmin || actor.role === AdminRoleName.PoliceSecurityOfficer) {
      return Boolean(actor.agencyId) && incident.assignedAgencyId === actor.agencyId;
    }
    return false;
  }

  private async createLocationUpdate(sessionId: string, incidentId: string, dto: LiveVideoLocationUpdateDto | StartLiveVideoDto) {
    return (this.prisma as any).liveVideoLocationUpdate.create({
      data: {
        liveVideoSessionId: sessionId,
        incidentId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        speed: dto.speed,
        heading: dto.heading,
        altitude: dto.altitude,
        capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : new Date(),
        sourceDeviceId: dto.sourceDeviceId,
        gpsLocation: undefined,
      } as never,
    });
  }

  private evidenceOverlay(
    incident: {
      id: string;
      reporterId?: string | null;
      isAnonymous?: boolean;
      submittedAt?: Date;
      address?: string | null;
      lga?: string | null;
      state?: string | null;
      reporter?: { profile?: { firstName?: string | null; lastName?: string | null } | null } | null;
    },
    session: { id: string },
    location?: { latitude: unknown; longitude: unknown; accuracy?: unknown; capturedAt: Date } | null,
  ) {
    const capturedAt = location?.capturedAt ?? new Date();
    const profile = incident.reporter?.profile;
    const reporterName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
    const reporter = incident.isAnonymous
      ? `Anonymous-${incident.id.slice(0, 4)}`
      : reporterName || (incident.reporterId ? `User ${incident.reporterId.slice(0, 8)}` : "Unknown reporter");
    const locationLabel = [incident.address, incident.lga, incident.state].filter(Boolean).join(", ") || "Location unavailable";
    return {
      title: "THE EYE LIVE EVIDENCE",
      incidentId: incident.id,
      date: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(capturedAt),
      time: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Africa/Lagos", timeZoneName: "short" }).format(capturedAt),
      gps: location ? `${location.latitude}, ${location.longitude}` : "Waiting for GPS",
      locationLabel,
      accuracy: location?.accuracy !== undefined && location?.accuracy !== null ? `±${location.accuracy}m` : "Unknown",
      reporter,
      sessionId: session.id,
    };
  }

  private mapLinks(latitude: unknown, longitude: unknown) {
    return {
      googleMaps: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
      openStreetMap: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`,
      mapboxFallback: `https://api.mapbox.com/styles/v1/mapbox/streets-v12.html?title=false&zoomwheel=false#18/${latitude}/${longitude}`,
    };
  }

  private signLocationToken(sessionId: string, adminId: string) {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const secret = this.config.get<string>("LIVE_LOCATION_LINK_SECRET", this.config.get<string>("JWT_ACCESS_SECRET", "dev-access-secret"));
    const body = `${sessionId}.${adminId}.${exp}`;
    const sig = createHmac("sha256", secret).update(body).digest("base64url");
    return Buffer.from(`${body}.${sig}`).toString("base64url");
  }

  private verifyLocationToken(sessionId: string, adminId: string, token: string) {
    try {
      const [tokenSessionId, tokenAdminId, exp, sig] = Buffer.from(token, "base64url").toString("utf8").split(".");
      if (tokenSessionId !== sessionId || tokenAdminId !== adminId || Number(exp) < Math.floor(Date.now() / 1000)) return false;
      const secret = this.config.get<string>("LIVE_LOCATION_LINK_SECRET", this.config.get<string>("JWT_ACCESS_SECRET", "dev-access-secret"));
      const expected = createHmac("sha256", secret).update(`${tokenSessionId}.${tokenAdminId}.${exp}`).digest("base64url");
      return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  private timeline(incidentId: string, actor: JwtPayload, eventType: string, message: string, metadata: Record<string, unknown>) {
    return this.prisma.incidentTimeline.create({
      data: {
        incidentId,
        actorId: actor.typ === "user" ? actor.sub : undefined,
        actorType: actor.typ,
        eventType,
        message,
        metadata,
      } as never,
    });
  }

  private audit(actor: JwtPayload, action: string, entityId: string, metadata: Record<string, unknown>) {
    return this.auditService.record({
      actor,
      action,
      entityType: "live_video_sessions",
      entityId,
      metadata,
    });
  }
}
