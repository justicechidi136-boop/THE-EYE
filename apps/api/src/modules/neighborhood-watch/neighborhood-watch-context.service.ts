import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { JwtPayload } from "../../common/auth/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { JurisdictionResolutionService } from "../incidents/jurisdiction-resolution.service";
import {
  buildDynamicAreaFromJurisdiction,
  buildDynamicAreaGeohashFallback,
  type DynamicAreaGeo,
  type NwContextType,
} from "./dynamic-public-area";

export type NwLocationStatus =
  | "CONFIRMED"
  | "LOCATION_REQUIRED"
  | "LOCATION_STALE"
  | "LOCATION_LOW_ACCURACY";

/** Fresh GPS window for context resolution and creating new posts. */
export const MAX_LOCATION_AGE_MS = 5 * 60 * 1000;
const MAX_ACCURACY_M = 100;
/** Presence TTL — comments/reactions may continue within this window without a brand-new GPS fix. */
export const PRESENCE_TTL_MS = 30 * 60 * 1000;
const MIN_SWITCH_DISPLACEMENT_M = 120;
const PRIVATE_NEARBY_RADIUS_M = 1500;

type PublicCommunityRow = {
  id: string;
  name: string;
  visibility: string;
  status: string;
  country: string;
  state: string | null;
  lga: string | null;
  description: string | null;
};

export type ResolveContextQuery = {
  lat?: string;
  lng?: string;
  accuracy?: string;
  capturedAt?: string;
};

@Injectable()
export class NeighborhoodWatchContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jurisdictionResolution: JurisdictionResolutionService,
  ) {}

  async resolveContext(actor: JwtPayload, query: ResolveContextQuery) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");

    const lat = query.lat != null ? Number(query.lat) : NaN;
    const lng = query.lng != null ? Number(query.lng) : NaN;
    const accuracy = query.accuracy != null ? Number(query.accuracy) : NaN;
    const capturedAt = query.capturedAt ? new Date(query.capturedAt) : null;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return this.locationFailure("LOCATION_REQUIRED");
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return this.locationFailure("LOCATION_REQUIRED");
    }
    if (!capturedAt || Number.isNaN(capturedAt.getTime())) {
      return this.locationFailure("LOCATION_REQUIRED");
    }
    const ageMs = Date.now() - capturedAt.getTime();
    if (ageMs > MAX_LOCATION_AGE_MS || ageMs < -60_000) {
      return this.locationFailure("LOCATION_STALE");
    }
    if (!Number.isFinite(accuracy) || accuracy <= 0 || accuracy > MAX_ACCURACY_M) {
      return this.locationFailure("LOCATION_LOW_ACCURACY");
    }

    const publicCommunity = await this.resolvePublicCommunity(lat, lng);
    if (publicCommunity) {
      return this.mappedPublicContext(actor, publicCommunity, {
        latitude: lat,
        longitude: lng,
        accuracyM: accuracy,
        capturedAt,
      });
    }

    return this.dynamicPublicAreaContext(actor, {
      latitude: lat,
      longitude: lng,
      accuracyM: accuracy,
      capturedAt,
    });
  }

  async setHomeCommunity(actor: JwtPayload, communityId: string | null) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen access required");
    if (communityId) {
      const community = await this.prisma.community.findUnique({ where: { id: communityId } });
      if (!community || community.status !== "Active") throw new NotFoundException("Community not found");
      if (community.visibility !== "Public") {
        throw new BadRequestException("Only public communities can be set as home community");
      }
    }
    await this.prisma.profile.update({
      where: { userId: actor.sub },
      data: { homeCommunityId: communityId },
    });
    await this.audit.record({
      actor,
      action: "community.home_set",
      entityType: "profiles",
      entityId: actor.sub,
      metadata: { homeCommunityId: communityId },
    });
    return { data: { homeCommunityId: communityId } };
  }

  private async mappedPublicContext(
    actor: JwtPayload,
    publicCommunity: PublicCommunityRow,
    coords: { latitude: number; longitude: number; accuracyM: number; capturedAt: Date },
  ) {
    const communityId = publicCommunity.id;
    const { latitude: lat, longitude: lng, accuracyM: accuracy, capturedAt } = coords;

    const previous = await this.prisma.communityPresence.findFirst({
      where: { userId: actor.sub, mode: "LocationParticipant" },
      orderBy: { updatedAt: "desc" },
      include: { community: true },
    });

    let switchRecommended = false;
    let switchMessage: string | null = null;
    if (previous && previous.communityId !== communityId) {
      const displacement = await this.distanceMeters(
        Number(previous.latitude),
        Number(previous.longitude),
        lat,
        lng,
      );
      switchRecommended = displacement >= MIN_SWITCH_DISPLACEMENT_M;
      if (switchRecommended) {
        switchMessage = `You're now in ${publicCommunity.name}. Neighborhood Watch has updated to show safety information for your current area.`;
      }
    }

    const expiresAt = new Date(Date.now() + PRESENCE_TTL_MS);
    await this.prisma.communityPresence.upsert({
      where: {
        userId_communityId_mode: {
          userId: actor.sub,
          communityId,
          mode: "LocationParticipant",
        },
      },
      update: {
        latitude: lat,
        longitude: lng,
        accuracyM: accuracy,
        capturedAt,
        expiresAt,
      },
      create: {
        userId: actor.sub,
        communityId,
        mode: "LocationParticipant",
        latitude: lat,
        longitude: lng,
        accuracyM: accuracy,
        capturedAt,
        expiresAt,
      },
    });

    const [privateNearby, safetySummary, homeCommunity, pinned, membership] = await Promise.all([
      this.listPrivateNearby(lat, lng, actor.sub),
      this.buildCommunitySafetySummary(communityId),
      this.getHomeCommunity(actor.sub),
      this.prisma.communityPinnedSafetyInfo.findMany({
        where: { communityId, active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 20,
      }),
      this.prisma.communityMembership.findUnique({
        where: { communityId_userId: { communityId, userId: actor.sub } },
        include: { role: true },
      }),
    ]);

    const roleName = membership?.role?.name ? String(membership.role.name) : null;
    const suspended = membership?.status === "Suspended" || membership?.status === "Banned";

    await this.audit.record({
      actor,
      action: "nw.mapped_public_community_resolved",
      entityType: "communities",
      entityId: communityId,
      metadata: { event: "NW_MAPPED_PUBLIC_COMMUNITY_RESOLVED" },
    });

    return {
      locationStatus: "CONFIRMED" as NwLocationStatus,
      contextType: "MAPPED_PUBLIC_COMMUNITY" as NwContextType,
      publicCommunity: this.toPublicCommunityCard(publicCommunity),
      dynamicArea: null,
      presence: {
        mode: "LOCATION_PARTICIPANT",
        communityId,
        dynamicAreaKey: null,
        capturedAt: capturedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        accuracyM: accuracy,
        switchRecommended,
        switchMessage,
      },
      homeCommunity,
      privateCommunitiesNearby: privateNearby,
      permissions: {
        canViewPublicFeed: true,
        canViewPublicSafety: true,
        canPost: !suspended,
        canComment: !suspended,
        canReportActivity: !suspended,
        canShareSecurityTip: !suspended,
        canVerify: !suspended,
        canViewPrivateFeed: membership?.status === "Approved",
        canModerate: Boolean(roleName && ["CommunityModerator", "EstateAdmin"].includes(roleName)),
        canManagePatrol: Boolean(
          roleName && ["CommunityModerator", "EstateAdmin", "VolunteerCoordinator"].includes(roleName),
        ),
      },
      safetySummary,
      pinnedSafetyInfo: pinned.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        category: row.category,
      })),
    };
  }

  private async dynamicPublicAreaContext(
    actor: JwtPayload,
    coords: { latitude: number; longitude: number; accuracyM: number; capturedAt: Date },
  ) {
    const { latitude: lat, longitude: lng, accuracyM: accuracy, capturedAt } = coords;
    const dynamicArea = await this.resolveDynamicArea(lat, lng);
    const expiresAt = new Date(Date.now() + PRESENCE_TTL_MS);

    const previous = await this.prisma.nwDynamicAreaPresence.findFirst({
      where: { userId: actor.sub },
      orderBy: { updatedAt: "desc" },
    });

    let switchRecommended = false;
    let switchMessage: string | null = null;
    if (previous && previous.areaKey !== dynamicArea.areaKey) {
      const displacement = await this.distanceMeters(
        Number(previous.latitude),
        Number(previous.longitude),
        lat,
        lng,
      );
      switchRecommended = displacement >= MIN_SWITCH_DISPLACEMENT_M;
      if (switchRecommended) {
        switchMessage = `You're now in ${dynamicArea.areaLabel}. Neighborhood Watch has updated to your current area.`;
      }
    }

    await this.prisma.nwDynamicAreaPresence.upsert({
      where: {
        userId_areaKey: {
          userId: actor.sub,
          areaKey: dynamicArea.areaKey,
        },
      },
      update: {
        areaCountry: dynamicArea.country,
        areaState: dynamicArea.state,
        areaLga: dynamicArea.lga,
        areaCity: dynamicArea.city,
        areaLabel: dynamicArea.areaLabel,
        latitude: lat,
        longitude: lng,
        accuracyM: accuracy,
        capturedAt,
        expiresAt,
      },
      create: {
        userId: actor.sub,
        areaKey: dynamicArea.areaKey,
        areaCountry: dynamicArea.country,
        areaState: dynamicArea.state,
        areaLga: dynamicArea.lga,
        areaCity: dynamicArea.city,
        areaLabel: dynamicArea.areaLabel,
        latitude: lat,
        longitude: lng,
        accuracyM: accuracy,
        capturedAt,
        expiresAt,
      },
    });

    const [privateNearby, safetySummary, homeCommunity] = await Promise.all([
      this.listPrivateNearby(lat, lng, actor.sub),
      this.buildDynamicAreaSafetySummary(dynamicArea.areaKey),
      this.getHomeCommunity(actor.sub),
    ]);

    await this.audit.record({
      actor,
      action: "nw.dynamic_area_resolved",
      entityType: "nw_dynamic_area_presence",
      entityId: actor.sub,
      metadata: {
        event: "NW_DYNAMIC_AREA_RESOLVED",
        areaKey: dynamicArea.areaKey,
        resolutionSource: dynamicArea.resolutionSource,
      },
    });

    return {
      locationStatus: "CONFIRMED" as NwLocationStatus,
      contextType: "DYNAMIC_PUBLIC_AREA" as NwContextType,
      publicCommunity: null,
      dynamicArea: {
        countryCode: dynamicArea.countryCode,
        stateCode: dynamicArea.stateCode,
        lgaCode: dynamicArea.lgaCode,
        city: dynamicArea.city,
        areaLabel: dynamicArea.areaLabel,
        areaKey: dynamicArea.areaKey,
        resolutionSource: dynamicArea.resolutionSource,
      },
      presence: {
        mode: "DYNAMIC_AREA_PARTICIPANT",
        communityId: null,
        dynamicAreaKey: dynamicArea.areaKey,
        capturedAt: capturedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        accuracyM: accuracy,
        switchRecommended,
        switchMessage,
      },
      homeCommunity,
      privateCommunitiesNearby: privateNearby,
      permissions: {
        canViewPublicFeed: true,
        canViewPublicSafety: true,
        canPost: true,
        canComment: true,
        canReportActivity: true,
        canShareSecurityTip: true,
        canVerify: true,
        canViewPrivateFeed: false,
        canModerate: false,
        canManagePatrol: false,
      },
      safetySummary,
      pinnedSafetyInfo: [],
    };
  }

  /**
   * Resolve geographic bucket from GPS only.
   * Never uses profile jurisdiction as current physical location.
   */
  private async resolveDynamicArea(lat: number, lng: number): Promise<DynamicAreaGeo> {
    const diagnostic = await this.jurisdictionResolution.diagnose(lat, lng);
    const match = diagnostic.polygonMatch ?? diagnostic.nearestMatch;
    if (match) {
      return buildDynamicAreaFromJurisdiction({
        country: match.country,
        state: match.state,
        lga: match.lga,
        resolutionSource: diagnostic.polygonMatch ? "jurisdiction_polygon" : "jurisdiction_nearest",
      });
    }
    return buildDynamicAreaGeohashFallback(lat, lng);
  }

  private locationFailure(locationStatus: Exclude<NwLocationStatus, "CONFIRMED">) {
    const contextType = locationStatus as NwContextType;
    return {
      locationStatus,
      contextType,
      publicCommunity: null,
      dynamicArea: null,
      presence: null,
      homeCommunity: null,
      privateCommunitiesNearby: [],
      permissions: {
        canViewPublicFeed: false,
        canViewPublicSafety: false,
        canPost: false,
        canComment: false,
        canReportActivity: false,
        canShareSecurityTip: false,
        canVerify: false,
        canViewPrivateFeed: false,
        canModerate: false,
        canManagePatrol: false,
      },
      safetySummary: {
        activeAlerts: 0,
        recentVerifiedIncidents: 0,
        roadHazards: 0,
        publicBroadcasts: 0,
        communityWarnings: 0,
      },
      pinnedSafetyInfo: [],
    };
  }

  private async resolvePublicCommunity(lat: number, lng: number): Promise<PublicCommunityRow | null> {
    const contained = await this.prisma.$queryRawUnsafe<PublicCommunityRow[]>(
      `SELECT id::text AS id, name, visibility::text AS visibility, status::text AS status,
              country, state, lga, description
         FROM communities
        WHERE status = 'Active'
          AND visibility = 'Public'
          AND boundary IS NOT NULL
          AND ST_Contains(boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
        ORDER BY ST_Area(boundary::geometry) ASC
        LIMIT 1`,
      lng,
      lat,
    );
    if (contained[0]) return contained[0];

    const nearby = await this.prisma.$queryRawUnsafe<PublicCommunityRow[]>(
      `SELECT id::text AS id, name, visibility::text AS visibility, status::text AS status,
              country, state, lga, description
         FROM communities
        WHERE status = 'Active'
          AND visibility = 'Public'
          AND center IS NOT NULL
          AND ST_DWithin(center, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 800)
        ORDER BY ST_Distance(center, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) ASC
        LIMIT 1`,
      lng,
      lat,
    );
    return nearby[0] ?? null;
  }

  private async listPrivateNearby(lat: number, lng: number, userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ id: string; name: string; distance_m: number }>
    >(
      `SELECT c.id, c.name,
              ST_Distance(COALESCE(c.center, ST_Centroid(c.boundary::geometry)::geography),
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m
         FROM communities c
        WHERE c.status = 'Active'
          AND c.visibility = 'Private'
          AND (
            (c.center IS NOT NULL AND ST_DWithin(c.center, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3))
            OR (c.boundary IS NOT NULL AND ST_DWithin(c.boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3))
          )
        ORDER BY distance_m ASC
        LIMIT 10`,
      lng,
      lat,
      PRIVATE_NEARBY_RADIUS_M,
    );
    const memberships = await this.prisma.communityMembership.findMany({
      where: { userId, communityId: { in: rows.map((r) => r.id) } },
      select: { communityId: true, status: true },
    });
    const byId = new Map(memberships.map((m) => [m.communityId, m.status]));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      approximateDistanceMeters: Math.round(Number(row.distance_m)),
      membershipStatus: byId.get(row.id) ?? null,
      accessHint: "Membership required. Being nearby does not grant private access.",
    }));
  }

  private async buildCommunitySafetySummary(communityId: string) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [activeAlerts, roadHazards, communityWarnings, verifiedPosts] = await Promise.all([
      this.prisma.communityAlert.count({
        where: { communityId, status: "Active", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      }),
      this.prisma.communityPost.count({
        where: {
          communityId,
          type: { in: ["RoadHazard", "RoadTraffic"] } as never,
          hiddenAt: null,
          hazardStatus: { in: ["Open", "Verified", "Ongoing"] },
          createdAt: { gte: since },
        },
      }),
      this.prisma.communityPost.count({
        where: {
          communityId,
          type: { in: ["LocalWarning", "SuspiciousActivity", "CrimeAlert"] },
          hiddenAt: null,
          createdAt: { gte: since },
        },
      }),
      this.prisma.communityPost.count({
        where: {
          communityId,
          verificationStatus: "Verified",
          hiddenAt: null,
          createdAt: { gte: since },
        },
      }),
    ]);
    return {
      activeAlerts,
      recentVerifiedIncidents: verifiedPosts,
      roadHazards,
      publicBroadcasts: 0,
      communityWarnings,
    };
  }

  private async buildDynamicAreaSafetySummary(areaKey: string) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const base = {
      targetType: "DYNAMIC_AREA" as const,
      dynamicAreaKey: areaKey,
      hiddenAt: null,
      createdAt: { gte: since },
    };
    const [roadHazards, communityWarnings, verifiedPosts] = await Promise.all([
      this.prisma.communityPost.count({
        where: {
          ...base,
          type: { in: ["RoadHazard", "RoadTraffic"] } as never,
          hazardStatus: { in: ["Open", "Verified", "Ongoing"] },
        } as never,
      }),
      this.prisma.communityPost.count({
        where: {
          ...base,
          type: { in: ["LocalWarning", "SuspiciousActivity", "CrimeAlert"] },
        } as never,
      }),
      this.prisma.communityPost.count({
        where: {
          ...base,
          verificationStatus: "Verified",
        } as never,
      }),
    ]);
    return {
      activeAlerts: 0,
      recentVerifiedIncidents: verifiedPosts,
      roadHazards,
      publicBroadcasts: 0,
      communityWarnings,
    };
  }

  private async getHomeCommunity(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { homeCommunity: true },
    });
    if (!profile?.homeCommunity) return null;
    return this.toPublicCommunityCard(profile.homeCommunity);
  }

  private toPublicCommunityCard(row: {
    id: string;
    name: string;
    country?: string | null;
    state?: string | null;
    lga?: string | null;
    description?: string | null;
    visibility?: string | null;
  }) {
    return {
      id: row.id,
      name: row.name,
      visibility: row.visibility ?? "Public",
      country: row.country ?? "",
      state: row.state ?? null,
      lga: row.lga ?? null,
      description: row.description ?? null,
      label: "Public Safety Community",
    };
  }

  private async distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ meters: number }>>(
      `SELECT ST_Distance(
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
        ) AS meters`,
      lng1,
      lat1,
      lng2,
      lat2,
    );
    return Number(rows[0]?.meters ?? 0);
  }
}
