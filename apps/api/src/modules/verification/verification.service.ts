import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AdminRoleName, IncidentPriority, IncidentStatus } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { ConfidenceScorerService } from "./confidence-scorer.service";
import { CrowdRequestDto, VerifyIncidentDto, WitnessConfirmationDto } from "./dto/verification.dto";
import { IncidentVerificationContext, VerificationDecision } from "./verification.types";

const DEFAULT_DUPLICATE_RADIUS_METERS = 500;
const DEFAULT_WITNESS_LIMIT = 25;

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorer: ConfidenceScorerService,
  ) {}

  async verifyIncident(incidentId: string, dto: VerifyIncidentDto = {}, actor?: JwtPayload) {
    const startedAt = Date.now();
    const context = await this.buildContext(incidentId, dto);
    const decision = this.scorer.score(context);

    await this.prisma.incidentVerification.create({
      data: {
        incidentId,
        verifierId: actor?.typ === "user" ? actor.sub : undefined,
        method: actor?.typ === "admin" ? "admin_system_review" : "system_ai_initial",
        result: decision.status,
        confidence: decision.confidenceScore,
        notes: JSON.stringify(decision.breakdown),
      } as never,
    });

    await this.prisma.incidentTimeline.create({
      data: {
        incidentId,
        actorId: actor?.typ === "user" ? actor.sub : undefined,
        actorType: actor?.typ ?? "system",
        eventType: "incident.verification_scored",
        message: `Verification confidence scored at ${decision.confidenceScore}.`,
        metadata: {
          status: decision.status,
          elapsedMs: Date.now() - startedAt,
          shouldRequestCrowdConfirmation: decision.shouldRequestCrowdConfirmation,
          shouldAutoEscalate: decision.shouldAutoEscalate,
          breakdown: decision.breakdown,
        },
      },
    });

    if (decision.shouldRequestCrowdConfirmation) {
      void this.requestCrowdConfirmation(incidentId, { radiusMeters: DEFAULT_DUPLICATE_RADIUS_METERS, limit: DEFAULT_WITNESS_LIMIT }, actor);
    }

    if (decision.shouldAutoEscalate) {
      await this.autoEscalateP1Incident(incidentId, decision);
    }

    return { incidentId, elapsedMs: Date.now() - startedAt, ...decision };
  }

  async detectDuplicates(incidentId: string, radiusMeters = DEFAULT_DUPLICATE_RADIUS_METERS) {
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException("Incident not found");

    return this.prisma.$queryRaw<Array<{ id: string; title: string; type: string; distance_meters: number; created_at: Date }>>`
      SELECT id, title, type::text, created_at,
        ST_Distance(gps_location, (SELECT gps_location FROM incidents WHERE id = ${incidentId}::uuid)) AS distance_meters
      FROM incidents
      WHERE id <> ${incidentId}::uuid
        AND type = ${incident.type}::"IncidentType"
        AND created_at >= now() - interval '24 hours'
        AND ST_DWithin(gps_location, (SELECT gps_location FROM incidents WHERE id = ${incidentId}::uuid), ${radiusMeters})
      ORDER BY distance_meters ASC, created_at DESC
      LIMIT 20
    `;
  }

  async requestCrowdConfirmation(incidentId: string, dto: CrowdRequestDto = {}, actor?: JwtPayload) {
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException("Incident not found");

    const limit = Math.min(dto.limit ?? DEFAULT_WITNESS_LIMIT, 100);
    const candidateUsers = await this.prisma.user.findMany({
      where: {
        ...(incident.reporterId ? { id: { not: incident.reporterId } } : {}),
        profile: { is: { country: incident.country, state: incident.state, lga: incident.lga } },
      },
      select: { id: true },
      take: limit,
    });

    if (candidateUsers.length) {
      await this.prisma.notification.createMany({
        data: candidateUsers.map((user) => ({
          userId: user.id,
          incidentId,
          channel: "push",
          title: "Can you confirm a nearby incident?",
          body: `THE EYE needs confirmation for: ${incident.title}`,
          status: "Pending" as never,
          provider: "fcm",
        })),
      });
    }

    await this.prisma.incidentTimeline.create({
      data: {
        incidentId,
        actorId: actor?.typ === "user" ? actor.sub : undefined,
        actorType: actor?.typ ?? "system",
        eventType: "incident.crowd_confirmation_requested",
        message: `Crowd confirmation requested from ${candidateUsers.length} nearby user(s).`,
        metadata: { targetMs: 10000, radiusMeters: dto.radiusMeters ?? DEFAULT_DUPLICATE_RADIUS_METERS, candidateCount: candidateUsers.length },
      },
    });

    return { incidentId, requested: candidateUsers.length, targetDispatchMs: 10000 };
  }

  async submitWitnessConfirmation(incidentId: string, dto: WitnessConfirmationDto, actor?: JwtPayload) {
    if (!actor || actor.typ !== "user") throw new BadRequestException("Witness confirmation requires a citizen user token");

    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException("Incident not found");

    const method = dto.trustedReporter ? "trusted_reporter_confirmation" : "nearby_user_confirmation";
    const result = dto.confirms ? "confirmed" : "disputed";

    await this.prisma.incidentVerification.create({
      data: {
        incidentId,
        verifierId: actor.sub,
        method,
        result,
        confidence: dto.confirms ? (dto.trustedReporter ? 90 : 70) : 20,
        notes: dto.note,
      } as never,
    });

    await this.prisma.incidentTimeline.create({
      data: {
        incidentId,
        actorId: actor.sub,
        actorType: "user",
        eventType: "incident.witness_confirmation_received",
        message: dto.confirms ? "Nearby witness confirmed the incident." : "Nearby witness disputed the incident.",
        metadata: { method, latitude: dto.latitude, longitude: dto.longitude },
      },
    });

    return this.verifyIncident(incidentId, { locationConsistencyMeters: this.estimateLocationConsistency(incident, dto) }, actor);
  }

  async dashboard() {
    const [pending, highConfidence, lowConfidence, recent] = await Promise.all([
      this.prisma.incident.count({ where: { status: { in: [IncidentStatus.Submitted as never, IncidentStatus.Received as never, IncidentStatus.Verifying as never] } } }),
      this.prisma.incidentVerification.count({ where: { result: "HighConfidence", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      this.prisma.incidentVerification.count({ where: { result: "LowConfidence", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      this.prisma.incidentVerification.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { incident: true, verifier: true } }),
    ]);

    return { pending, highConfidenceLast24h: highConfidence, lowConfidenceLast24h: lowConfidence, recent };
  }

  private async buildContext(incidentId: string, dto: VerifyIncidentDto): Promise<IncidentVerificationContext> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        media: true,
        liveVideoSessions: true,
        reporter: { include: { trustedReporter: true } },
        verifications: true,
      },
    });

    if (!incident) throw new NotFoundException("Incident not found");

    const duplicates = await this.detectDuplicates(incidentId);
    const nearbyUserConfirmations = incident.verifications.filter((item) => item.method === "nearby_user_confirmation" && item.result === "confirmed").length;
    const trustedReporterConfirmations = incident.verifications.filter((item) => item.method === "trusted_reporter_confirmation" && item.result === "confirmed").length;
    const adminConfirmations = incident.verifications.filter((item) => item.method.includes("admin") && ["confirmed", "HighConfidence", "LikelyValid"].includes(item.result)).length;
    const historicalFalseReports = incident.reporterId ? await this.historicalFalseReports(incident.reporterId) : 0;

    return {
      incidentId,
      priority: incident.priority as IncidentPriority,
      status: incident.status as IncidentStatus,
      gpsAccuracyMeters: dto.gpsAccuracyMeters ?? this.gpsAccuracyFromMetadata(incident.metadata),
      reporterTrustScore: incident.reporter?.trustedReporter?.trustScore ? Number(incident.reporter.trustedReporter.trustScore) : undefined,
      mediaEvidenceCount: incident.media.length,
      hasLiveVideo: incident.liveVideoSessions.some((session) => !session.endedAt),
      duplicateReportsNearby: duplicates.length,
      minutesSinceIncident: Math.max(0, Math.round((Date.now() - incident.createdAt.getTime()) / 60000)),
      locationConsistencyMeters: dto.locationConsistencyMeters ?? this.locationConsistencyFromIncident(incident),
      nearbyUserConfirmations,
      trustedReporterConfirmations,
      adminConfirmations,
      historicalFalseReports,
    };
  }

  private async historicalFalseReports(userId: string) {
    return this.prisma.incident.count({ where: { reporterId: userId, status: IncidentStatus.FalseReport as never } });
  }

  private gpsAccuracyFromMetadata(metadata: unknown) {
    if (metadata && typeof metadata === "object" && "gpsAccuracyMeters" in metadata) {
      const value = Number((metadata as Record<string, unknown>).gpsAccuracyMeters);
      return Number.isFinite(value) ? value : undefined;
    }
    return undefined;
  }

  private locationConsistencyFromIncident(incident: { latitude: unknown; longitude: unknown; manualLatitude?: unknown; manualLongitude?: unknown }) {
    if (incident.manualLatitude === null || incident.manualLatitude === undefined || incident.manualLongitude === null || incident.manualLongitude === undefined) return undefined;
    return this.haversineMeters(Number(incident.latitude), Number(incident.longitude), Number(incident.manualLatitude), Number(incident.manualLongitude));
  }

  private estimateLocationConsistency(incident: { latitude: unknown; longitude: unknown }, dto: WitnessConfirmationDto) {
    if (dto.latitude === undefined || dto.longitude === undefined) return undefined;
    return this.haversineMeters(Number(incident.latitude), Number(incident.longitude), dto.latitude, dto.longitude);
  }

  private haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const radius = 6371000;
    const toRad = (value: number) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async autoEscalateP1Incident(incidentId: string, decision: VerificationDecision) {
    await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: IncidentStatus.Verified as never,
        metadata: { verification: { autoEscalated: true, confidenceScore: decision.confidenceScore } },
        timeline: {
          create: {
            actorType: "system",
            eventType: "incident.auto_escalated",
            message: `High-confidence P1 incident auto-escalated at ${decision.confidenceScore}.`,
            metadata: { confidenceScore: decision.confidenceScore, target: "immediate" },
          },
        },
      } as never,
    });
  }
}

