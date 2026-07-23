import { Injectable, NotFoundException } from "@nestjs/common";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { encodePoliceCursor } from "./dto/police-station.dto";
import { GooglePlacesPoliceProvider } from "./google-places-police.provider";
import {
  parseNearbyPoliceQuery,
  type NearbyPoliceStationsQuery,
  type VerifyPoliceStationDto,
} from "./dto/police-station.dto";
import {
  POLICE_DATA_SOURCES,
  type PoliceDataSource,
  type PoliceStationNearbyResult,
  type PoliceVerificationStatus,
  VERIFIED_POLICE_STATUSES,
} from "./police-station.types";

const DEDUPE_DISTANCE_METERS = 150;

@Injectable()
export class PoliceLocatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googlePlaces: GooglePlacesPoliceProvider,
    private readonly auditService: AuditService,
  ) {}

  async nearby(query: NearbyPoliceStationsQuery) {
    const parsed = parseNearbyPoliceQuery(query);
    const verifiedRows = await this.searchVerifiedNearby(parsed);
    const verifiedResults = verifiedRows.map((row) => this.mapVerifiedRow(row));

    let googleResults: PoliceStationNearbyResult[] = [];
    let googleProviderStatus: "disabled" | "ok" | "failed" = "disabled";

    const verifiedEnough = verifiedResults.length >= parsed.limit;
    if (this.googlePlaces.isEnabled() && !verifiedEnough) {
      const googleResponse = await this.googlePlaces.searchNearby({
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        radiusMeters: parsed.radiusMeters,
        limit: parsed.limit,
        search: parsed.search,
      });
      googleProviderStatus = googleResponse.status;
      await this.recordPlaceReferences(googleResponse.results.map((place) => place.placeId));
      googleResults = this.deduplicateGoogleResults(verifiedResults, googleResponse.results.map((place) => ({
        id: `google:${place.placeId}`,
        name: place.name,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        distanceMeters: this.haversineMeters(parsed.latitude, parsed.longitude, place.latitude, place.longitude),
        phone: place.phone,
        navigationUrl: place.navigationUrl,
        dataSource: "googlePlaces" as PoliceDataSource,
        verificationStatus: "GoogleMapsResult" as const,
        googlePlaceId: place.placeId,
        googleAttribution: place.attribution,
      })));
    } else if (this.googlePlaces.isEnabled()) {
      googleProviderStatus = "ok";
    }

    const combined = [...verifiedResults, ...googleResults]
      .sort((a, b) => (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (b.distanceMeters ?? Number.MAX_SAFE_INTEGER))
      .slice(0, parsed.limit);
    const nextOffset = parsed.offset + combined.length;

    return {
      data: combined,
      meta: {
        verifiedCount: verifiedResults.length,
        googleCount: googleResults.length,
        googlePlacesEnabled: this.googlePlaces.isEnabled(),
        googleProviderStatus,
        radiusMeters: parsed.radiusMeters,
        limit: parsed.limit,
        offset: parsed.offset,
        nextCursor: combined.length >= parsed.limit ? encodePoliceCursor(nextOffset) : null,
        attribution: combined.some((row) => row.dataSource === POLICE_DATA_SOURCES[1])
          ? "Some results are provided by Google Maps and are not officially verified by THE EYE."
          : null,
      },
    };
  }

  async verifyStation(id: string, dto: VerifyPoliceStationDto, actor: JwtPayload) {
    const existing = await this.prisma.policeStation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Police station not found");

    const station = await this.prisma.policeStation.update({
      where: { id },
      data: {
        verificationStatus: dto.verificationStatus,
        source: dto.source,
        sourceReference: dto.sourceReference,
        verifiedAt: dto.verificationStatus === "Closed" || dto.verificationStatus === "Duplicate"
          ? null
          : new Date(),
        verifiedBy: actor.sub,
        lastReviewedAt: new Date(),
        isActive: dto.verificationStatus !== "Closed" && dto.verificationStatus !== "Duplicate",
        officialPhone: dto.officialPhone,
        emergencyPhone: dto.emergencyPhone,
        googlePlaceId: dto.googlePlaceId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        address: dto.address,
        name: dto.officialName,
        phone: dto.officialPhone,
      } as never,
    });

    await this.auditService.record({
      actor,
      action: "police_station.verified",
      entityType: "police_stations",
      entityId: id,
      metadata: {
        verificationStatus: dto.verificationStatus,
        source: dto.source,
        sourceReference: dto.sourceReference,
        verificationNotes: dto.verificationNotes ?? null,
        before: { verificationStatus: existing.verificationStatus, isActive: existing.isActive },
        after: { verificationStatus: station.verificationStatus, isActive: station.isActive },
      },
    });

    return { data: station };
  }

  private async searchVerifiedNearby(parsed: ReturnType<typeof parseNearbyPoliceQuery>) {
    return this.prisma.$queryRawUnsafe(
      `SELECT ps.id,
              ps.name,
              ps.address,
              ps.agency_type,
              ps.station_type,
              ps.latitude,
              ps.longitude,
              ps.official_phone,
              ps.phone,
              ps.emergency_phone,
              ps.verification_status,
              ps.google_place_id,
              COALESCE(ps.state, j.state) AS state,
              COALESCE(ps.lga, j.lga) AS lga,
              COALESCE(ps.country, j.country) AS country,
              ST_Distance(ps.gps_location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
         FROM police_stations ps
         JOIN jurisdictions j ON j.id = ps.jurisdiction_id
        WHERE ps.is_active = true
          AND ps.verification_status = ANY($6::text[])
          AND ST_DWithin(ps.gps_location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
          AND ($4::text IS NULL OR COALESCE(ps.state, j.state) ILIKE $4)
          AND ($5::text IS NULL OR COALESCE(ps.lga, j.lga) ILIKE $5)
          AND ($7::text IS NULL OR ps.name ILIKE $7 OR ps.address ILIKE $7)
        ORDER BY distance_meters ASC
        OFFSET $8
        LIMIT $9`,
      parsed.longitude,
      parsed.latitude,
      parsed.radiusMeters,
      parsed.state ? `%${parsed.state}%` : null,
      parsed.lga ? `%${parsed.lga}%` : null,
      VERIFIED_POLICE_STATUSES,
      parsed.search ? `%${parsed.search}%` : null,
      parsed.offset,
      parsed.limit,
    ) as Promise<Array<Record<string, unknown>>>;
  }

  private mapVerifiedRow(row: Record<string, unknown>): PoliceStationNearbyResult {
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    const placeId = row.google_place_id ? String(row.google_place_id) : undefined;
    return {
      id: String(row.id),
      name: String(row.name),
      address: String(row.address),
      latitude,
      longitude,
      distanceMeters: row.distance_meters == null ? null : Number(row.distance_meters),
      phone: (row.official_phone as string | null) ?? (row.phone as string | null) ?? null,
      navigationUrl: placeId
        ? this.googlePlaces.placeNavigationUrl(placeId, latitude, longitude)
        : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`,
      dataSource: "verifiedDatabase",
      verificationStatus: String(row.verification_status) as PoliceVerificationStatus,
      googlePlaceId: placeId,
      state: row.state as string | null,
      lga: row.lga as string | null,
      stationType: (row.station_type as string | null) ?? (row.agency_type as string | null),
    };
  }

  private deduplicateGoogleResults(
    verified: PoliceStationNearbyResult[],
    google: PoliceStationNearbyResult[],
  ) {
    return google.filter((candidate) => {
      if (candidate.googlePlaceId && verified.some((row) => row.googlePlaceId === candidate.googlePlaceId)) {
        return false;
      }
      const normalizedCandidate = this.normalizeLabel(`${candidate.name} ${candidate.address}`);
      return !verified.some((row) => {
        const normalizedVerified = this.normalizeLabel(`${row.name} ${row.address}`);
        const distance = this.haversineMeters(
          row.latitude,
          row.longitude,
          candidate.latitude,
          candidate.longitude,
        );
        return normalizedCandidate === normalizedVerified || distance <= DEDUPE_DISTANCE_METERS;
      });
    });
  }

  private async recordPlaceReferences(placeIds: string[]) {
    if (!placeIds.length) return;
    await Promise.all(
      placeIds.map((placeId) =>
        this.prisma.googlePlaceReference.upsert({
          where: { placeId },
          create: { placeId },
          update: { lastFetchedAt: new Date() },
        }),
      ),
    );
  }

  private normalizeLabel(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  private haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const earthRadius = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
