import { BadRequestException, Injectable } from "@nestjs/common";
import type { JwtPayload } from "../../common/auth/jwt";
import { PrismaService } from "../prisma/prisma.service";

export const JurisdictionResolutionStatus = {
  ResolvedByCoordinates: "ResolvedByCoordinates",
  ResolvedByNearestBoundary: "ResolvedByNearestBoundary",
  ResolvedByProfileFallback: "ResolvedByProfileFallback",
  AwaitingManualResolution: "AwaitingManualResolution",
  OutsideSupportedJurisdiction: "OutsideSupportedJurisdiction",
  LocationUnavailable: "LocationUnavailable",
} as const;

export type JurisdictionResolutionStatusValue =
  (typeof JurisdictionResolutionStatus)[keyof typeof JurisdictionResolutionStatus];

export type ResolvedJurisdiction = {
  id: string;
  country: string;
  state: string;
  lga: string;
  resolutionStatus: JurisdictionResolutionStatusValue;
  resolutionSource: string;
  distanceMeters?: number;
};

export type JurisdictionDiagnosticResult = {
  latitude: number;
  longitude: number;
  hasValidCoordinates: boolean;
  polygonMatch: { id: string; country: string; state: string; lga: string } | null;
  nearestMatch: { id: string; country: string; state: string; lga: string; distanceMeters: number } | null;
  profileFallback: { id: string; country: string; state: string; lga: string } | null;
  defaultFallback: { id: string; country: string; state: string; lga: string } | null;
  resolutionStatus: JurisdictionResolutionStatusValue;
  resolutionSource: string;
};

const DEFAULT_COUNTRY = "Nigeria";
const DEFAULT_STATE = "Lagos";
const DEFAULT_LGA = "Ikeja";
const NEAREST_TOLERANCE_METERS = 100_000;

@Injectable()
export class JurisdictionResolutionService {
  constructor(private readonly prisma: PrismaService) {}

  isValidCoordinate(latitude: number, longitude: number): boolean {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
    if (latitude === 0 && longitude === 0) return false;
    return true;
  }

  async resolve(input: {
    latitude: number;
    longitude: number;
    actor?: JwtPayload;
  }): Promise<ResolvedJurisdiction> {
    const { latitude, longitude, actor } = input;
    const hasValidCoords = this.isValidCoordinate(latitude, longitude);

    if (hasValidCoords) {
      const polygonMatch = await this.matchByPolygon(latitude, longitude);
      if (polygonMatch) {
        return {
          ...polygonMatch,
          resolutionStatus: JurisdictionResolutionStatus.ResolvedByCoordinates,
          resolutionSource: "postgis_polygon",
        };
      }

      const nearest = await this.matchNearestBoundary(latitude, longitude);
      if (nearest) {
        return {
          id: nearest.id,
          country: nearest.country,
          state: nearest.state,
          lga: nearest.lga,
          distanceMeters: nearest.distanceMeters,
          resolutionStatus: JurisdictionResolutionStatus.ResolvedByNearestBoundary,
          resolutionSource: "postgis_nearest_boundary",
        };
      }
    }

    const profileFallback = await this.matchProfileFallback(actor);
    if (profileFallback) {
      return {
        ...profileFallback,
        resolutionStatus: JurisdictionResolutionStatus.ResolvedByProfileFallback,
        resolutionSource: "user_profile",
      };
    }

    const defaultFallback = await this.matchDefaultHierarchy();
    if (defaultFallback) {
      return {
        ...defaultFallback,
        resolutionStatus: hasValidCoords
          ? JurisdictionResolutionStatus.OutsideSupportedJurisdiction
          : JurisdictionResolutionStatus.LocationUnavailable,
        resolutionSource: "default_hierarchy",
      };
    }

    const anyJurisdiction = await this.prisma.jurisdiction.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, country: true, state: true, lga: true },
    });
    if (anyJurisdiction) {
      return {
        ...anyJurisdiction,
        resolutionStatus: JurisdictionResolutionStatus.AwaitingManualResolution,
        resolutionSource: "global_unassigned_queue",
      };
    }

    throw new BadRequestException(
      "Jurisdiction data is not configured. Your report could not be routed. Contact support.",
    );
  }

  async diagnose(latitude: number, longitude: number, actor?: JwtPayload): Promise<JurisdictionDiagnosticResult> {
    const hasValidCoordinates = this.isValidCoordinate(latitude, longitude);
    const polygonMatch = hasValidCoordinates ? await this.matchByPolygon(latitude, longitude) : null;
    const nearestMatch = hasValidCoordinates ? await this.matchNearestBoundary(latitude, longitude) : null;
    const profileFallback = await this.matchProfileFallback(actor);
    const defaultFallback = await this.matchDefaultHierarchy();
    const resolved = await this.resolve({ latitude, longitude, actor });

    return {
      latitude,
      longitude,
      hasValidCoordinates,
      polygonMatch,
      nearestMatch,
      profileFallback,
      defaultFallback,
      resolutionStatus: resolved.resolutionStatus,
      resolutionSource: resolved.resolutionSource,
    };
  }

  private async matchByPolygon(latitude: number, longitude: number) {
    const matches = await this.prisma.$queryRaw<Array<{ id: string; country: string; state: string; lga: string }>>`
      SELECT id, country, state, lga
      FROM jurisdictions
      WHERE boundary IS NOT NULL
        AND ST_Covers(boundary, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography)
      LIMIT 1
    `;
    return matches[0] ?? null;
  }

  private async matchNearestBoundary(latitude: number, longitude: number) {
    const matches = await this.prisma.$queryRaw<
      Array<{ id: string; country: string; state: string; lga: string; distance_meters: number }>
    >`
      SELECT
        id,
        country,
        state,
        lga,
        ST_Distance(
          boundary,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
        ) AS distance_meters
      FROM jurisdictions
      WHERE boundary IS NOT NULL
      ORDER BY distance_meters ASC
      LIMIT 1
    `;
    const match = matches[0];
    if (!match || match.distance_meters > NEAREST_TOLERANCE_METERS) return null;
    return {
      id: match.id,
      country: match.country,
      state: match.state,
      lga: match.lga,
      distanceMeters: Math.round(match.distance_meters),
    };
  }

  private async matchProfileFallback(actor?: JwtPayload) {
    if (actor?.typ !== "user" || !actor.sub) return null;

    const profile = await this.prisma.profile.findUnique({
      where: { userId: actor.sub },
      select: { country: true, state: true, lga: true },
    });
    if (!profile?.country || !profile.state || !profile.lga) return null;

    const jurisdiction = await this.prisma.jurisdiction.findFirst({
      where: {
        country: profile.country,
        state: profile.state,
        lga: profile.lga,
      },
      select: { id: true, country: true, state: true, lga: true },
    });
    return jurisdiction;
  }

  private async matchDefaultHierarchy() {
    const candidates = [
      { country: DEFAULT_COUNTRY, state: DEFAULT_STATE, lga: DEFAULT_LGA },
      { country: DEFAULT_COUNTRY, state: DEFAULT_STATE, lga: "All" },
      { country: DEFAULT_COUNTRY, state: "All", lga: "All" },
    ];

    for (const candidate of candidates) {
      const jurisdiction = await this.prisma.jurisdiction.findFirst({
        where: candidate,
        select: { id: true, country: true, state: true, lga: true },
      });
      if (jurisdiction) return jurisdiction;
    }

    return null;
  }
}
