import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { IncidentPriority, IncidentStatus } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { MetricsService } from "../../common/metrics/metrics.service";
import { BroadcastsService } from "../broadcasts/broadcasts.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConfidenceScorerService } from "./confidence-scorer.service";
import {
  AdminVerificationReviewDto,
  CrowdRequestDto,
  VerifyIncidentDto,
  WitnessConfirmationDto,
} from "./dto/verification.dto";
import { IncidentVerificationContext, VerificationDecision } from "./verification.types";
import {
  buildDuplicateSignal,
  buildGpsValidationSignal,
  buildMediaEvidenceSignal,
  buildTrustedReporterSignal,
  haversineMeters,
  withinVerificationTarget,
} from "./verification-signals";

const DEFAULT_DUPLICATE_RADIUS_METERS = 500;
const DEFAULT_WITNESS_LIMIT = 25;
const MAX_VERIFICATION_HISTORY = 20;

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorer: ConfidenceScorerService,
    private readonly broadcasts: BroadcastsService,
    private readonly metrics: MetricsService,
    private readonly notifications: NotificationsService,
  ) {}

  async verifyIncident(incidentId: string, dto: VerifyIncidentDto = {}, actor?: JwtPayload) {
    const startedAt = Date.now();
    const method = actor?.typ === "admin" ? "admin_system_review" : "system_ai_initial";
    try {
      const context = await this.buildContext(incidentId, dto);
      const decision = this.scorer.score(context);
      const elapsedMs = Date.now() - startedAt;
      const withinTarget = withinVerificationTarget(elapsedMs);

      const writes: Promise<unknown>[] = [
        this.prisma.incidentVerification.create({
          data: {
            incidentId,
            verifierId: actor?.typ === "user" ? actor.sub : undefined,
            method,
            result: decision.status,
            confidence: decision.confidenceScore,
            notes: JSON.stringify({ breakdown: decision.breakdown, withinTarget, elapsedMs }),
          } as never,
        }),
        this.prisma.incidentTimeline.create({
          data: {
            incidentId,
            actorId: actor?.typ === "user" ? actor.sub : undefined,
            actorType: actor?.typ ?? "system",
            eventType: "incident.verification_scored",
            message: `Verification confidence scored at ${decision.confidenceScore}.`,
            metadata: {
              status: decision.status,
              elapsedMs,
              withinTarget,
              shouldRequestCrowdConfirmation: decision.shouldRequestCrowdConfirmation,
              shouldAutoEscalate: decision.shouldAutoEscalate,
              breakdown: decision.breakdown,
            },
          },
        }),
      ];

      if (context.status === IncidentStatus.Submitted || context.status === IncidentStatus.Received) {
        writes.push(
          this.prisma.incident.update({
            where: { id: incidentId },
            data: { status: IncidentStatus.Verifying as never },
          }),
        );
      }

      await Promise.all(writes);

      if (decision.shouldRequestCrowdConfirmation) {
        void this.requestCrowdConfirmation(incidentId, { radiusMeters: DEFAULT_DUPLICATE_RADIUS_METERS, limit: DEFAULT_WITNESS_LIMIT }, actor);
      }

      if (decision.shouldAutoEscalate) {
        await this.autoEscalateP1Incident(incidentId, decision);
      }

      this.metrics.recordVerification(method, elapsedMs / 1000, "success");
      return { incidentId, elapsedMs, withinTarget, ...decision };
    } catch (error) {
      this.metrics.recordVerification(method, (Date.now() - startedAt) / 1000, "error");
      throw error;
    }
  }

  async adminReviewIncident(incidentId: string, dto: AdminVerificationReviewDto, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can review verification outcomes");
    if (!["confirm", "reject", "needs_more_evidence"].includes(dto.decision)) {
      throw new BadRequestException("decision must be confirm, reject, or needs_more_evidence");
    }

    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException("Incident not found");

    const result =
      dto.decision === "confirm"
        ? "confirmed"
        : dto.decision === "reject"
          ? "rejected"
          : "needs_more_evidence";
    const confidence = dto.confidenceOverride ?? (dto.decision === "confirm" ? 90 : dto.decision === "reject" ? 15 : 50);

    await this.prisma.incidentVerification.create({
      data: {
        incidentId,
        method: "admin_manual_review",
        result,
        confidence,
        notes: dto.note,
      } as never,
    });

    const nextStatus =
      dto.decision === "confirm"
        ? IncidentStatus.Verified
        : dto.decision === "reject"
          ? IncidentStatus.FalseReport
          : IncidentStatus.Verifying;

    await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: nextStatus as never,
        timeline: {
          create: {
            actorType: "admin",
            eventType: "incident.admin_verification_review",
            message:
              dto.decision === "confirm"
                ? "Admin confirmed incident verification."
                : dto.decision === "reject"
                  ? "Admin rejected incident as false report."
                  : "Admin requested more evidence before verification.",
            metadata: { decision: dto.decision, note: dto.note, confidence, adminId: actor.sub },
          },
        },
      } as never,
    });

    return this.verifyIncident(incidentId, {}, actor);
  }

  async detectDuplicates(incidentId: string, radiusMeters = DEFAULT_DUPLICATE_RADIUS_METERS) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: { id: true, type: true, title: true, latitude: true, longitude: true },
    });
    if (!incident) throw new NotFoundException("Incident not found");
    return this.detectDuplicatesForIncident(incident, radiusMeters);
  }

  async requestCrowdConfirmation(incidentId: string, dto: CrowdRequestDto = {}, actor?: JwtPayload) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: { id: true, reporterId: true, title: true, latitude: true, longitude: true, country: true, state: true, lga: true },
    });
    if (!incident) throw new NotFoundException("Incident not found");

    const limit = Math.min(dto.limit ?? DEFAULT_WITNESS_LIMIT, 100);
    const radiusMeters = dto.radiusMeters ?? DEFAULT_DUPLICATE_RADIUS_METERS;
    const latitude = Number(incident.latitude);
    const longitude = Number(incident.longitude);

    let candidateUsers: Array<{ id: string }> = [];
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      const nearby = await this.findNearbyWitnesses(latitude, longitude, radiusMeters, incident.reporterId, limit);
      candidateUsers = nearby.map((row) => ({ id: row.userId }));
    }

    if (!candidateUsers.length) {
      candidateUsers = await this.prisma.user.findMany({
        where: {
          ...(incident.reporterId ? { id: { not: incident.reporterId } } : {}),
          profile: { is: { country: incident.country, state: incident.state, lga: incident.lga } },
        },
        select: { id: true },
        take: limit,
      });
    }

    if (candidateUsers.length) {
      await Promise.all(
        candidateUsers.map(async (user) => {
          const notification = await this.prisma.notification.create({
            data: {
              userId: user.id,
              incidentId,
              channel: "push",
              title: "Can you confirm a nearby incident?",
              body: `THE EYE needs confirmation for: ${incident.title}`,
              status: "Pending" as never,
              provider: "fcm",
            },
          });
          await this.notifications.enqueue({
            notificationId: notification.id,
            userId: user.id,
            channel: "push",
            title: notification.title,
            body: notification.body,
            incidentId,
            provider: "fcm",
          });
        }),
      );
    }

    await this.prisma.incidentTimeline.create({
      data: {
        incidentId,
        actorId: actor?.typ === "user" ? actor.sub : undefined,
        actorType: actor?.typ ?? "system",
        eventType: "incident.crowd_confirmation_requested",
        message: `Crowd confirmation requested from ${candidateUsers.length} nearby user(s).`,
        metadata: { targetMs: 10000, radiusMeters, candidateCount: candidateUsers.length, geoScoped: Boolean(candidateUsers.length) },
      },
    });

    return { incidentId, requested: candidateUsers.length, targetDispatchMs: 10000, radiusMeters };
  }

  async submitWitnessConfirmation(incidentId: string, dto: WitnessConfirmationDto, actor: JwtPayload) {
    if (!actor || actor.typ !== "user") throw new BadRequestException("Witness confirmation requires a citizen user token");

    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException("Incident not found");

    const trustedReporter = await this.prisma.trustedReporter.findUnique({ where: { userId: actor.sub } });
    const isTrusted = Boolean(trustedReporter && !trustedReporter.revokedAt) || Boolean(dto.trustedReporter);
    const method = isTrusted ? "trusted_reporter_confirmation" : "nearby_user_confirmation";
    const result = dto.confirms ? "confirmed" : "disputed";

    await this.prisma.incidentVerification.create({
      data: {
        incidentId,
        verifierId: actor.sub,
        method,
        result,
        confidence: dto.confirms ? (isTrusted ? 90 : 70) : 20,
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
        metadata: { method, latitude: dto.latitude, longitude: dto.longitude, trustedReporter: isTrusted },
      },
    });

    return this.verifyIncident(incidentId, { locationConsistencyMeters: this.estimateLocationConsistency(incident, dto) }, actor);
  }

  async listWitnessConfirmations(incidentId: string) {
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException("Incident not found");

    const rows = await this.prisma.incidentVerification.findMany({
      where: {
        incidentId,
        method: { in: ["nearby_user_confirmation", "trusted_reporter_confirmation"] },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { verifier: { include: { profile: true } } },
    });

    return {
      data: rows.map((row) => ({
        id: row.id,
        incidentId: row.incidentId,
        verifierId: row.verifierId,
        verifierName: row.verifier?.profile
          ? `${row.verifier.profile.firstName} ${row.verifier.profile.lastName}`.trim()
          : row.verifier?.email ?? "Witness",
        method: row.method,
        result: row.result,
        confidence: row.confidence ? Number(row.confidence) : null,
        notes: row.notes,
        createdAt: row.createdAt,
      })),
    };
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
        media: { include: { accessLogs: { select: { id: true }, take: 1 } } },
        liveVideoSessions: { select: { id: true, endedAt: true }, take: 3 },
        reporter: { include: { trustedReporter: true } },
        verifications: { orderBy: { createdAt: "desc" }, take: MAX_VERIFICATION_HISTORY },
      },
    });

    if (!incident) throw new NotFoundException("Incident not found");

    const [duplicates, historicalFalseReports, duplicateHashes] = await Promise.all([
      this.detectDuplicatesForIncident(incident, DEFAULT_DUPLICATE_RADIUS_METERS),
      incident.reporterId ? this.historicalFalseReports(incident.reporterId) : Promise.resolve(0),
      incident.media.length ? this.countDuplicateMediaHashes(incident.media.map((item) => item.fileHash), incidentId) : Promise.resolve(0),
    ]);

    const mediaEvidence = buildMediaEvidenceSignal(
      incident.media.map((item) => ({
        id: item.id,
        fileHash: item.fileHash,
        latitude: item.latitude,
        longitude: item.longitude,
        capturedAt: item.capturedAt,
        uploadedAt: item.uploadedAt,
        mediaType: String(item.mediaType),
        accessLogs: item.accessLogs,
      })),
      incident.createdAt,
    );
    mediaEvidence.duplicateHashElsewhere = duplicateHashes;

    const gpsValidation = buildGpsValidationSignal(incident, incident.media, dto.gpsAccuracyMeters);
    const duplicateSignal = buildDuplicateSignal(duplicates);
    const trustedReporterSignal = buildTrustedReporterSignal(incident.reporter?.trustedReporter);

    const nearbyUserConfirmations = incident.verifications.filter((item) => item.method === "nearby_user_confirmation" && item.result === "confirmed").length;
    const trustedReporterConfirmations = incident.verifications.filter((item) => item.method === "trusted_reporter_confirmation" && item.result === "confirmed").length;
    const adminConfirmations = incident.verifications.filter(
      (item) =>
        item.method.includes("admin") &&
        ["confirmed", "HighConfidence", "LikelyValid", "needs_more_evidence"].includes(item.result),
    ).length;

    return {
      incidentId,
      priority: incident.priority as IncidentPriority,
      status: incident.status as IncidentStatus,
      gpsAccuracyMeters: gpsValidation.accuracyMeters,
      reporterTrustScore: trustedReporterSignal.trustScore ?? undefined,
      mediaEvidenceCount: incident.media.length,
      hasLiveVideo: incident.liveVideoSessions.some((session) => !session.endedAt),
      duplicateReportsNearby: duplicateSignal.count,
      minutesSinceIncident: Math.max(0, Math.round((Date.now() - incident.createdAt.getTime()) / 60000)),
      locationConsistencyMeters: dto.locationConsistencyMeters ?? this.locationConsistencyFromIncident(incident),
      nearbyUserConfirmations,
      trustedReporterConfirmations,
      adminConfirmations,
      historicalFalseReports,
      gpsValidation,
      mediaEvidence,
      duplicateSignal,
      trustedReporterSignal,
    };
  }

  private async detectDuplicatesForIncident(
    incident: { id: string; type: unknown; title?: string },
    radiusMeters: number,
  ) {
    return this.prisma.$queryRaw<Array<{ id: string; title: string; type: string; distance_meters: number; created_at: Date }>>`
      WITH source AS (
        SELECT gps_location, type, title
          FROM incidents
         WHERE id = ${incident.id}::uuid
      )
      SELECT i.id, i.title, i.type::text, i.created_at,
        ST_Distance(i.gps_location, source.gps_location) AS distance_meters
      FROM incidents i
      CROSS JOIN source
      WHERE i.id <> ${incident.id}::uuid
        AND i.type = source.type
        AND i.created_at >= now() - interval '24 hours'
        AND source.gps_location IS NOT NULL
        AND i.gps_location IS NOT NULL
        AND ST_DWithin(i.gps_location, source.gps_location, ${radiusMeters})
      ORDER BY distance_meters ASC, i.created_at DESC
      LIMIT 20
    `;
  }

  private async findNearbyWitnesses(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    excludeUserId: string | null | undefined,
    limit: number,
  ) {
    if (excludeUserId) {
      return this.prisma.$queryRaw<Array<{ userId: string; distanceMeters: number }>>`
        WITH latest_user_location AS (
          SELECT DISTINCT ON (u.id)
                 u.id AS user_id,
                 COALESCE(vp.gps_location, i.gps_location, s.gps_location) AS gps_location
            FROM users u
            LEFT JOIN volunteer_profiles vp ON vp.user_id = u.id AND vp.gps_location IS NOT NULL
            LEFT JOIN incidents i ON i.reporter_id = u.id AND i.gps_location IS NOT NULL
            LEFT JOIN sos_events s ON s.user_id = u.id AND s.gps_location IS NOT NULL
           WHERE COALESCE(vp.gps_location, i.gps_location, s.gps_location) IS NOT NULL
             AND u.id <> ${excludeUserId}::uuid
           ORDER BY u.id, vp.created_at DESC NULLS LAST, i.created_at DESC NULLS LAST, s.triggered_at DESC NULLS LAST
        )
        SELECT user_id AS "userId",
               ST_Distance(
                 gps_location,
                 ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
               ) AS "distanceMeters"
          FROM latest_user_location
         WHERE ST_DWithin(
           gps_location,
           ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
           ${radiusMeters}
         )
         ORDER BY "distanceMeters" ASC
         LIMIT ${limit}
      `;
    }

    return this.prisma.$queryRaw<Array<{ userId: string; distanceMeters: number }>>`
      WITH latest_user_location AS (
        SELECT DISTINCT ON (u.id)
               u.id AS user_id,
               COALESCE(vp.gps_location, i.gps_location, s.gps_location) AS gps_location
          FROM users u
          LEFT JOIN volunteer_profiles vp ON vp.user_id = u.id AND vp.gps_location IS NOT NULL
          LEFT JOIN incidents i ON i.reporter_id = u.id AND i.gps_location IS NOT NULL
          LEFT JOIN sos_events s ON s.user_id = u.id AND s.gps_location IS NOT NULL
         WHERE COALESCE(vp.gps_location, i.gps_location, s.gps_location) IS NOT NULL
         ORDER BY u.id, vp.created_at DESC NULLS LAST, i.created_at DESC NULLS LAST, s.triggered_at DESC NULLS LAST
      )
      SELECT user_id AS "userId",
             ST_Distance(
               gps_location,
               ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
             ) AS "distanceMeters"
        FROM latest_user_location
       WHERE ST_DWithin(
         gps_location,
         ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
         ${radiusMeters}
       )
       ORDER BY "distanceMeters" ASC
       LIMIT ${limit}
    `;
  }

  private async countDuplicateMediaHashes(fileHashes: string[], incidentId: string) {
    if (!fileHashes.length) return 0;
    const rows = await this.prisma.incidentMedia.findMany({
      where: { fileHash: { in: fileHashes }, incidentId: { not: incidentId } },
      select: { fileHash: true },
      take: 20,
    });
    return new Set(rows.map((row) => row.fileHash)).size;
  }

  private async historicalFalseReports(userId: string) {
    return this.prisma.incident.count({ where: { reporterId: userId, status: IncidentStatus.FalseReport as never } });
  }

  private locationConsistencyFromIncident(incident: { latitude: unknown; longitude: unknown; manualLatitude?: unknown; manualLongitude?: unknown }) {
    if (incident.manualLatitude === null || incident.manualLatitude === undefined || incident.manualLongitude === null || incident.manualLongitude === undefined) {
      return undefined;
    }
    return haversineMeters(Number(incident.latitude), Number(incident.longitude), Number(incident.manualLatitude), Number(incident.manualLongitude));
  }

  private estimateLocationConsistency(incident: { latitude: unknown; longitude: unknown }, dto: WitnessConfirmationDto) {
    if (dto.latitude === undefined || dto.longitude === undefined) return undefined;
    return haversineMeters(Number(incident.latitude), Number(incident.longitude), dto.latitude, dto.longitude);
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

    void this.broadcasts.autoBroadcastVerifiedIncident(incidentId, decision.confidenceScore).catch(() => undefined);
  }
}
