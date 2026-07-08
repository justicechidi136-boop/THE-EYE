import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";
import type { JwtPayload } from "../../common/auth/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { LinkLiveVideoEvidenceDto, LiveVideoLocationUpdateDto, StartLiveVideoDto, validateEvidenceLink, validateLocationUpdate } from "./dto/live-video.dto";
import { LiveKitTokenService } from "./livekit-token.service";

@Injectable()
export class LiveVideoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly livekitTokens: LiveKitTokenService,
    private readonly config: ConfigService,
  ) {}

  async startIncidentLiveVideo(incidentId: string, dto: StartLiveVideoDto, actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Only citizens can start emergency live video");
    validateLocationUpdate(dto);
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException("Incident not found");
    if (incident.reporterId && incident.reporterId !== actor.sub) throw new ForbiddenException("Only the reporting user can start live video for this incident");

    const roomName = `eye-incident-${incidentId}`;
    const identity = `user-${actor.sub}`;
    const session = await this.prisma.liveVideoSession.upsert({
      where: { roomName },
      update: {
        status: "Active",
        endedAt: null,
        startedAt: new Date(),
        createdById: actor.sub,
        lowBandwidthMode: dto.lowBandwidthMode ?? false,
        participantIdentity: identity,
        metadata: { lowBandwidthMode: dto.lowBandwidthMode ?? false, role: "publisher" },
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
        metadata: { lowBandwidthMode: dto.lowBandwidthMode ?? false, role: "publisher" },
      } as never,
    });

    await this.timeline(incidentId, actor, "live_video.started", dto.lowBandwidthMode ? "Emergency live video started in low-bandwidth mode." : "Emergency live video started.", { sessionId: session.id, roomName });
    const location = await this.createLocationUpdate(session.id, incidentId, dto);
    await this.audit(actor, "live_video.started", session.id, { incidentId, roomName, lowBandwidthMode: dto.lowBandwidthMode ?? false });

    return {
      data: { ...session, latestLocation: location, evidenceOverlay: this.evidenceOverlay(incident, session, location) },
      livekit: {
        url: this.livekitTokens.livekitUrl(),
        roomName,
        token: this.livekitTokens.createToken({ identity, name: "Citizen emergency video", roomName, canPublish: true, canSubscribe: false, lowBandwidthMode: dto.lowBandwidthMode }),
      },
    };
  }

  async stopIncidentLiveVideo(sessionId: string, actor: JwtPayload) {
    const session = await this.prisma.liveVideoSession.findUnique({ where: { id: sessionId }, include: { incident: true } });
    if (!session) throw new NotFoundException("Live video session not found");
    if (actor.typ === "user" && session.createdById !== actor.sub) throw new ForbiddenException("Only the stream owner can stop this live video");
    if (actor.typ === "admin") await this.assertAdminCanAccessIncident(session.incidentId, actor);

    const updated = await this.prisma.liveVideoSession.update({ where: { id: sessionId }, data: { status: "Ended", endedAt: new Date() } as never });
    await this.timeline(session.incidentId, actor, "live_video.stopped", "Emergency live video stopped.", { sessionId });
    await this.audit(actor, "live_video.stopped", sessionId, { incidentId: session.incidentId });
    return { data: updated };
  }

  async adminViewToken(sessionId: string, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can view incident live streams");
    const session = await this.prisma.liveVideoSession.findUnique({ where: { id: sessionId }, include: { incident: true, locationUpdates: { orderBy: { capturedAt: "desc" }, take: 1 } } });
    if (!session) throw new NotFoundException("Live video session not found");
    await this.assertAdminCanAccessIncident(session.incidentId, actor);

    const identity = `admin-${actor.sub}`;
    await this.audit(actor, "live_video.admin_view_token_created", sessionId, { incidentId: session.incidentId });
    return {
      data: { ...session, evidenceOverlay: this.evidenceOverlay(session.incident, session, session.locationUpdates[0]) },
      livekit: {
        url: this.livekitTokens.livekitUrl(),
        roomName: session.roomName,
        token: this.livekitTokens.createToken({ identity, name: actor.email ?? "THE EYE admin", roomName: session.roomName, canPublish: false, canSubscribe: true }),
      },
    };
  }

  async activeSessions(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can list active live streams");
    const sessions = await this.prisma.liveVideoSession.findMany({
      where: { status: "Active" },
      include: { incident: true, locationUpdates: { orderBy: { capturedAt: "desc" }, take: 1 } },
      orderBy: { startedAt: "desc" },
      take: 100,
    });
    if (actor.role === "Super Admin") return { data: sessions };
    return {
      data: sessions.filter((session) =>
        session.incident.country === actor.country &&
        session.incident.state === actor.state &&
        session.incident.lga === actor.lga &&
        (!actor.agencyId || session.incident.assignedAgencyId === actor.agencyId)),
    };
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
    if (actor.typ !== "user") throw new ForbiddenException("Only the citizen stream owner can update live video location");
    validateLocationUpdate(dto);
    const session = await this.prisma.liveVideoSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException("Live video session not found");
    if (session.createdById !== actor.sub) throw new ForbiddenException("Only the stream owner can update this live video location");
    const location = await this.createLocationUpdate(session.id, session.incidentId, dto);
    return { data: location, realtime: { event: "live_video.location.updated", sessionId, pollIntervalMs: 5000 } };
  }

  async latestLocation(sessionId: string, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can view live video location");
    const session = await this.prisma.liveVideoSession.findUnique({ where: { id: sessionId }, include: { incident: true, locationUpdates: { orderBy: { capturedAt: "desc" }, take: 1 } } });
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
    if (actor.role === "Super Admin") return;
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException("Incident not found");
    const jurisdictionAllowed = incident.country === actor.country && incident.state === actor.state && incident.lga === actor.lga;
    const agencyAllowed = !actor.agencyId || incident.assignedAgencyId === actor.agencyId;
    if (!jurisdictionAllowed || !agencyAllowed) throw new ForbiddenException("Admin cannot view live streams outside assigned scope");
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

  private evidenceOverlay(incident: { id: string; reporterId?: string | null; isAnonymous?: boolean; submittedAt?: Date }, session: { id: string }, location?: { latitude: unknown; longitude: unknown; accuracy?: unknown; capturedAt: Date } | null) {
    const capturedAt = location?.capturedAt ?? new Date();
    const reporter = incident.isAnonymous ? `Anonymous-${incident.id.slice(0, 4)}` : incident.reporterId ?? "Unknown";
    return {
      title: "THE EYE LIVE EVIDENCE",
      incidentId: incident.id,
      date: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(capturedAt),
      time: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Africa/Lagos", timeZoneName: "short" }).format(capturedAt),
      gps: location ? `${location.latitude}, ${location.longitude}` : "Waiting for GPS",
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
    return this.prisma.auditLog.create({
      data: {
        actorUserId: actor.typ === "user" ? actor.sub : undefined,
        actorAdminId: actor.typ === "admin" ? actor.sub : undefined,
        actorType: actor.typ,
        action,
        entityType: "live_video_sessions",
        entityId,
        metadata,
      } as never,
    });
  }
}
