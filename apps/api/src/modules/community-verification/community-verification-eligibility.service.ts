import { Injectable } from "@nestjs/common";
import { IncidentStatus, IncidentType } from "@the-eye/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  ACTIVE_INCIDENT_STATUSES,
  BLOCKED_INCIDENT_TYPES,
  DEFAULT_VERIFICATION_RADIUS_METERS,
  MAX_LOCATION_FRESHNESS_MINUTES,
  PASSIVE_ONLY_INCIDENT_TYPES,
  VERIFICATION_REQUEST_COOLDOWN_MINUTES,
} from "./community-verification.constants";

export interface EligibleNearbyUser {
  userId: string;
  distanceMeters: number;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  passiveOnly?: boolean;
  candidates: EligibleNearbyUser[];
}

@Injectable()
export class CommunityVerificationEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateIncidentEligibility(incidentId: string, options?: { radiusMeters?: number; limit?: number }): Promise<EligibilityResult> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: {
        id: true,
        reporterId: true,
        type: true,
        status: true,
        latitude: true,
        longitude: true,
        country: true,
        state: true,
        lga: true,
        assignments: { where: { status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] as never[] } }, take: 1 },
      },
    });
    if (!incident) return { eligible: false, reason: "Incident not found", candidates: [] };

    if (!ACTIVE_INCIDENT_STATUSES.includes(incident.status as IncidentStatus)) {
      return { eligible: false, reason: "Incident is not active", candidates: [] };
    }

    const incidentType = incident.type as IncidentType;
    if (BLOCKED_INCIDENT_TYPES.has(incidentType)) {
      return { eligible: false, reason: "Incident category blocked for community verification", candidates: [] };
    }

    const passiveOnly = PASSIVE_ONLY_INCIDENT_TYPES.has(incidentType) || incident.assignments.length > 0;
    const latitude = Number(incident.latitude);
    const longitude = Number(incident.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { eligible: false, reason: "Incident location unavailable", candidates: [] };
    }

    const radiusMeters = options?.radiusMeters ?? DEFAULT_VERIFICATION_RADIUS_METERS;
    const limit = Math.min(options?.limit ?? 25, 100);
    const nearby = await this.findEligibleNearbyUsers({
      latitude,
      longitude,
      radiusMeters,
      excludeUserId: incident.reporterId,
      incidentId,
      limit,
    });

    return {
      eligible: nearby.length > 0,
      reason: nearby.length ? undefined : "No eligible nearby users",
      passiveOnly,
      candidates: nearby,
    };
  }

  async isUserEligibleForRequest(input: {
    userId: string;
    incidentId: string;
    reporterId: string | null;
    distanceMeters: number;
    radiusMeters: number;
  }) {
    if (input.reporterId && input.userId === input.reporterId) {
      return { eligible: false, reason: "Reporter cannot verify own incident" };
    }
    if (input.distanceMeters > input.radiusMeters) {
      return { eligible: false, reason: "User outside verification radius" };
    }

    const [existingActive, recentRequest, user] = await Promise.all([
      this.prisma.communityVerificationRequest.findFirst({
        where: {
          incidentId: input.incidentId,
          targetUserId: input.userId,
          status: { in: ["Pending", "Delivered", "Opened"] as never[] },
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      }),
      this.prisma.communityVerificationRequest.findFirst({
        where: {
          targetUserId: input.userId,
          issuedAt: { gte: new Date(Date.now() - VERIFICATION_REQUEST_COOLDOWN_MINUTES * 60_000) },
        },
        orderBy: { issuedAt: "desc" },
        select: { id: true },
      }),
      this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, status: true, createdAt: true },
      }),
    ]);

    if (existingActive) return { eligible: false, reason: "Active request already exists" };
    if (recentRequest) return { eligible: false, reason: "Request cooldown active" };
    if (!user || user.status !== "Active") return { eligible: false, reason: "User inactive" };

    return { eligible: true, accountAgeDays: Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000) };
  }

  private async findEligibleNearbyUsers(input: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    excludeUserId: string | null;
    incidentId: string;
    limit: number;
  }): Promise<EligibleNearbyUser[]> {
    const freshnessCutoff = new Date(Date.now() - MAX_LOCATION_FRESHNESS_MINUTES * 60_000);
    const rows = input.excludeUserId
      ? await this.prisma.$queryRaw<Array<{ userId: string; distanceMeters: number }>>`
          WITH latest_user_location AS (
            SELECT DISTINCT ON (u.id)
                   u.id AS user_id,
                   COALESCE(vp.gps_location, i.gps_location, s.gps_location) AS gps_location,
                   GREATEST(
                     COALESCE(vp.updated_at, vp.created_at, 'epoch'::timestamptz),
                     COALESCE(i.created_at, 'epoch'::timestamptz),
                     COALESCE(s.triggered_at, 'epoch'::timestamptz)
                   ) AS location_at
              FROM users u
              LEFT JOIN volunteer_profiles vp ON vp.user_id = u.id AND vp.gps_location IS NOT NULL
              LEFT JOIN incidents i ON i.reporter_id = u.id AND i.gps_location IS NOT NULL
              LEFT JOIN sos_events s ON s.user_id = u.id AND s.gps_location IS NOT NULL
             WHERE u.status = 'Active'
               AND u.id <> ${input.excludeUserId}::uuid
               AND COALESCE(vp.gps_location, i.gps_location, s.gps_location) IS NOT NULL
             ORDER BY u.id, vp.updated_at DESC NULLS LAST, i.created_at DESC NULLS LAST, s.triggered_at DESC NULLS LAST
          )
          SELECT user_id AS "userId",
                 ST_Distance(
                   gps_location,
                   ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography
                 ) AS "distanceMeters"
            FROM latest_user_location
           WHERE location_at >= ${freshnessCutoff}
             AND ST_DWithin(
               gps_location,
               ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography,
               ${input.radiusMeters}
             )
           ORDER BY "distanceMeters" ASC
           LIMIT ${input.limit}
        `
      : await this.prisma.$queryRaw<Array<{ userId: string; distanceMeters: number }>>`
          WITH latest_user_location AS (
            SELECT DISTINCT ON (u.id)
                   u.id AS user_id,
                   COALESCE(vp.gps_location, i.gps_location, s.gps_location) AS gps_location,
                   GREATEST(
                     COALESCE(vp.updated_at, vp.created_at, 'epoch'::timestamptz),
                     COALESCE(i.created_at, 'epoch'::timestamptz),
                     COALESCE(s.triggered_at, 'epoch'::timestamptz)
                   ) AS location_at
              FROM users u
              LEFT JOIN volunteer_profiles vp ON vp.user_id = u.id AND vp.gps_location IS NOT NULL
              LEFT JOIN incidents i ON i.reporter_id = u.id AND i.gps_location IS NOT NULL
              LEFT JOIN sos_events s ON s.user_id = u.id AND s.gps_location IS NOT NULL
             WHERE u.status = 'Active'
               AND COALESCE(vp.gps_location, i.gps_location, s.gps_location) IS NOT NULL
             ORDER BY u.id, vp.updated_at DESC NULLS LAST, i.created_at DESC NULLS LAST, s.triggered_at DESC NULLS LAST
          )
          SELECT user_id AS "userId",
                 ST_Distance(
                   gps_location,
                   ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography
                 ) AS "distanceMeters"
            FROM latest_user_location
           WHERE location_at >= ${freshnessCutoff}
             AND ST_DWithin(
               gps_location,
               ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography,
               ${input.radiusMeters}
             )
           ORDER BY "distanceMeters" ASC
           LIMIT ${input.limit}
        `;

    const eligible: EligibleNearbyUser[] = [];
    for (const row of rows) {
      const check = await this.isUserEligibleForRequest({
        userId: row.userId,
        incidentId: input.incidentId,
        reporterId: input.excludeUserId,
        distanceMeters: Number(row.distanceMeters),
        radiusMeters: input.radiusMeters,
      });
      if (check.eligible) {
        eligible.push({ userId: row.userId, distanceMeters: Math.round(Number(row.distanceMeters)) });
      }
    }
    return eligible;
  }
}
