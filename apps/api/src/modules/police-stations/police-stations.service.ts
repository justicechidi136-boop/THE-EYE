import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { JurisdictionResolutionService } from "../incidents/jurisdiction-resolution.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  CheckPoliceDuplicatesDto,
  parseNearestQuery,
  PoliceStationListQuery,
  PoliceStationSearchQuery,
  NearestPoliceStationsQuery,
  UpsertPoliceStationDto,
  validatePoliceStationDto,
} from "./dto/police-station.dto";
import {
  assertActorCanManagePolice,
  assertJurisdictionScope,
  assertSourceNotGoogleOnlyForOfficialVerification,
  DUPLICATE_PROXIMITY_METERS,
  normalizeAddress,
  normalizePhone,
  normalizeStationName,
  sanitizeSource,
  sanitizeSourceReference,
} from "./police-station-scope";

type DuplicateMatch = {
  id: string;
  name: string;
  address: string;
  verificationStatus: string;
  matchReasons: string[];
};

@Injectable()
export class PoliceStationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly jurisdictionResolution: JurisdictionResolutionService,
  ) {}

  async list(query: PoliceStationListQuery) {
    if (query.latitude && query.longitude) {
      return this.nearest({
        latitude: query.latitude,
        longitude: query.longitude,
        radiusMeters: query.radius,
        limit: query.limit,
        agencyType: query.agencyType,
      });
    }
    return this.search({
      state: query.state,
      lga: query.lga,
      q: query.search ?? query.q,
      agencyType: query.agencyType,
      limit: query.limit,
    });
  }

  async nearest(query: NearestPoliceStationsQuery) {
    const parsed = parseNearestQuery(query);
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT ps.id,
              ps.name,
              ps.phone,
              ps.address,
              ps.agency_type,
              ps.latitude,
              ps.longitude,
              j.country,
              j.state,
              j.lga,
              a.name AS agency_name,
              ST_Distance(ps.gps_location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
         FROM police_stations ps
         JOIN jurisdictions j ON j.id = ps.jurisdiction_id
         LEFT JOIN agencies a ON a.id = ps.agency_id
        WHERE ST_DWithin(ps.gps_location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
        AND ps.is_active = true
          AND ($4::text IS NULL OR ps.agency_type = $4)
        ORDER BY ps.gps_location <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        LIMIT $5`,
      parsed.longitude,
      parsed.latitude,
      parsed.radiusMeters,
      parsed.agencyType ?? null,
      parsed.limit,
    ) as Array<Record<string, unknown>>;
    return { data: rows.map((row) => this.mapStationRow(row)) };
  }

  async search(query: PoliceStationSearchQuery) {
    const limit = query.limit ? Math.min(Math.max(Number(query.limit), 1), 100) : 100;
    const rows = await this.prisma.policeStation.findMany({
      where: {
        agencyType: query.agencyType,
        jurisdiction: {
          state: query.state,
          lga: query.lga,
        },
        OR: (query.q ?? query.search)
          ? [
              { name: { contains: query.q ?? query.search, mode: "insensitive" } },
              { address: { contains: query.q ?? query.search, mode: "insensitive" } },
            ]
          : undefined,
      } as never,
      include: { agency: true, jurisdiction: true },
      orderBy: { name: "asc" },
      take: limit,
    });
    return { data: rows.map((station) => this.mapAdminStation(station)) };
  }

  async getById(id: string, actor: JwtPayload) {
    assertActorCanManagePolice(actor);
    const station = await this.prisma.policeStation.findUnique({
      where: { id },
      include: { agency: true, jurisdiction: true },
    });
    if (!station) throw new NotFoundException("Police station not found");
    assertJurisdictionScope(actor, station.jurisdiction);
    return { data: this.mapAdminStation(station) };
  }

  async checkDuplicates(dto: CheckPoliceDuplicatesDto, actor: JwtPayload) {
    assertActorCanManagePolice(actor);
    const duplicates = await this.findPossibleDuplicates(dto);
    return { data: duplicates };
  }

  async create(dto: UpsertPoliceStationDto, actor: JwtPayload) {
    assertActorCanManagePolice(actor);
    validatePoliceStationDto(dto);
    const source = sanitizeSource(dto.source);
    const sourceReference = sanitizeSourceReference(dto.sourceReference);
    const verificationStatus = dto.verificationStatus ?? "Unverified";
    assertSourceNotGoogleOnlyForOfficialVerification(source, verificationStatus);

    const jurisdiction = await this.resolveJurisdiction(dto, actor);
    assertJurisdictionScope(actor, jurisdiction);

    const officialPhone = normalizePhone(dto.officialPhone ?? dto.phone);
    const emergencyPhone = normalizePhone(dto.emergencyPhone);
    const duplicates = await this.findPossibleDuplicates({
      name: dto.name,
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
      officialPhone,
      emergencyPhone,
      googlePlaceId: dto.googlePlaceId,
      sourceReference,
    });
    if (duplicates.length && !dto.duplicateOverrideReason?.trim()) {
      throw new ConflictException({
        message: "Possible duplicate police station records detected",
        errorCode: "ERR-POLICE-DUP-001",
        duplicates,
      });
    }

    const station = await (this.prisma as any).policeStation.create({
      data: {
        agencyId: dto.agencyId,
        jurisdictionId: jurisdiction.id,
        name: dto.name.trim(),
        phone: officialPhone,
        officialPhone,
        emergencyPhone,
        address: dto.address.trim(),
        agencyType: dto.agencyType.trim(),
        stationType: (dto.stationType ?? dto.agencyType).trim(),
        country: dto.country?.trim() ?? jurisdiction.country,
        state: dto.state?.trim() ?? jurisdiction.state,
        lga: dto.lga?.trim() ?? jurisdiction.lga,
        latitude: dto.latitude,
        longitude: dto.longitude,
        source,
        sourceReference,
        verificationStatus,
        verifiedAt: verificationStatus === "VerifiedOfficial" || verificationStatus === "VerifiedByAdmin"
          ? new Date()
          : null,
        verifiedBy: verificationStatus === "VerifiedOfficial" || verificationStatus === "VerifiedByAdmin"
          ? actor.sub
          : null,
        googlePlaceId: dto.googlePlaceId?.trim() || null,
        isActive: dto.isActive ?? (verificationStatus !== "Closed" && verificationStatus !== "Duplicate"),
      } as never,
    });

    await this.audit(actor, "police_station.created", station.id, {
      name: dto.name,
      agencyType: dto.agencyType,
      verificationStatus,
      duplicateOverrideReason: dto.duplicateOverrideReason ?? null,
    });
    return { data: this.mapAdminStation(station) };
  }

  async update(id: string, dto: UpsertPoliceStationDto, actor: JwtPayload) {
    assertActorCanManagePolice(actor);
    validatePoliceStationDto(dto);
    const existing = await this.prisma.policeStation.findUnique({
      where: { id },
      include: { jurisdiction: true },
    });
    if (!existing) throw new NotFoundException("Police station not found");
    assertJurisdictionScope(actor, existing.jurisdiction);

    const source = sanitizeSource(dto.source);
    const sourceReference = sanitizeSourceReference(dto.sourceReference);
    const officialPhone = normalizePhone(dto.officialPhone ?? dto.phone);
    const emergencyPhone = normalizePhone(dto.emergencyPhone);

    const jurisdiction = dto.jurisdictionId
      ? await this.loadJurisdiction(dto.jurisdictionId)
      : existing.jurisdiction;
    if (dto.country || dto.state || dto.lga) {
      const resolved = await this.resolveJurisdiction({ ...dto, jurisdictionId: jurisdiction.id }, actor);
      assertJurisdictionScope(actor, resolved);
    }

    const duplicates = await this.findPossibleDuplicates({
      name: dto.name,
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
      officialPhone,
      emergencyPhone,
      googlePlaceId: dto.googlePlaceId,
      sourceReference,
      excludeId: id,
    });
    if (duplicates.length && !dto.duplicateOverrideReason?.trim()) {
      throw new ConflictException({
        message: "Possible duplicate police station records detected",
        errorCode: "ERR-POLICE-DUP-001",
        duplicates,
      });
    }

    const station = await this.prisma.policeStation.update({
      where: { id },
      data: {
        agencyId: dto.agencyId,
        jurisdictionId: jurisdiction.id,
        name: dto.name.trim(),
        phone: officialPhone,
        officialPhone,
        emergencyPhone,
        address: dto.address.trim(),
        agencyType: dto.agencyType.trim(),
        stationType: (dto.stationType ?? dto.agencyType).trim(),
        country: dto.country?.trim() ?? jurisdiction.country,
        state: dto.state?.trim() ?? jurisdiction.state,
        lga: dto.lga?.trim() ?? jurisdiction.lga,
        latitude: dto.latitude,
        longitude: dto.longitude,
        source,
        sourceReference,
        isActive: dto.isActive ?? existing.isActive,
      } as never,
      include: { agency: true, jurisdiction: true },
    });

    await this.audit(actor, "police_station.updated", station.id, {
      before: {
        name: existing.name,
        address: existing.address,
        officialPhone: existing.officialPhone,
        emergencyPhone: existing.emergencyPhone,
      },
      after: {
        name: station.name,
        address: station.address,
        officialPhone: station.officialPhone,
        emergencyPhone: station.emergencyPhone,
      },
      duplicateOverrideReason: dto.duplicateOverrideReason ?? null,
    });
    return { data: this.mapAdminStation(station) };
  }

  private async findPossibleDuplicates(input: CheckPoliceDuplicatesDto): Promise<DuplicateMatch[]> {
    const normalizedName = normalizeStationName(input.name);
    const normalizedAddress = normalizeAddress(input.address);
    const officialPhone = normalizePhone(input.officialPhone);
    const emergencyPhone = normalizePhone(input.emergencyPhone);
    const matches = new Map<string, DuplicateMatch>();

    const candidates = await this.prisma.policeStation.findMany({
      where: {
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
        OR: [
          input.googlePlaceId ? { googlePlaceId: input.googlePlaceId } : undefined,
          input.sourceReference ? { sourceReference: input.sourceReference } : undefined,
          { name: { equals: input.name.trim(), mode: "insensitive" } },
          officialPhone ? { officialPhone } : undefined,
          officialPhone ? { phone: officialPhone } : undefined,
          emergencyPhone ? { emergencyPhone } : undefined,
        ].filter(Boolean) as never[],
      },
      select: {
        id: true,
        name: true,
        address: true,
        verificationStatus: true,
        latitude: true,
        longitude: true,
        googlePlaceId: true,
        sourceReference: true,
        officialPhone: true,
        emergencyPhone: true,
        phone: true,
      },
      take: 25,
    });

    for (const candidate of candidates) {
      const reasons: string[] = [];
      if (input.googlePlaceId && candidate.googlePlaceId === input.googlePlaceId) reasons.push("googlePlaceId");
      if (input.sourceReference && candidate.sourceReference === input.sourceReference) reasons.push("sourceReference");
      if (normalizeStationName(candidate.name) === normalizedName) reasons.push("normalizedName");
      if (normalizeAddress(candidate.address) === normalizedAddress) reasons.push("address");
      if (officialPhone && (candidate.officialPhone === officialPhone || candidate.phone === officialPhone)) reasons.push("officialPhone");
      if (emergencyPhone && candidate.emergencyPhone === emergencyPhone) reasons.push("emergencyPhone");
      const distance = this.haversineMeters(
        input.latitude,
        input.longitude,
        Number(candidate.latitude),
        Number(candidate.longitude),
      );
      if (distance <= DUPLICATE_PROXIMITY_METERS) reasons.push(`proximity:${Math.round(distance)}m`);
      if (reasons.length) {
        matches.set(candidate.id, {
          id: candidate.id,
          name: candidate.name,
          address: candidate.address,
          verificationStatus: candidate.verificationStatus,
          matchReasons: reasons,
        });
      }
    }

    return [...matches.values()];
  }

  private async resolveJurisdiction(dto: UpsertPoliceStationDto, actor: JwtPayload) {
    if (dto.jurisdictionId) {
      return this.loadJurisdiction(dto.jurisdictionId);
    }
    if (dto.country && dto.state && dto.lga) {
      const byHierarchy = await this.prisma.jurisdiction.findFirst({
        where: {
          country: { equals: dto.country, mode: "insensitive" },
          state: { equals: dto.state, mode: "insensitive" },
          lga: { equals: dto.lga, mode: "insensitive" },
        },
      });
      if (byHierarchy) return byHierarchy;
      throw new BadRequestException("No jurisdiction found for the provided country, state, and LGA");
    }
    const resolved = await this.jurisdictionResolution.resolve({
      latitude: dto.latitude,
      longitude: dto.longitude,
      actor,
    });
    return this.loadJurisdiction(resolved.id);
  }

  private async loadJurisdiction(id: string) {
    const jurisdiction = await this.prisma.jurisdiction.findUnique({ where: { id } });
    if (!jurisdiction) throw new BadRequestException("jurisdictionId is invalid");
    return jurisdiction;
  }

  private mapAdminStation(station: Record<string, unknown>) {
    const jurisdiction = (station.jurisdiction as Record<string, unknown> | undefined) ?? {};
    const latitude = Number(station.latitude);
    const longitude = Number(station.longitude);
    return {
      ...station,
      latitude,
      longitude,
      country: station.country ?? jurisdiction.country ?? null,
      state: station.state ?? jurisdiction.state ?? null,
      lga: station.lga ?? jurisdiction.lga ?? null,
      navigationUrl: this.googleMapsUrl(latitude, longitude),
    };
  }

  private googleMapsUrl(latitude: unknown, longitude: unknown) {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
  }

  private mapStationRow(row: Record<string, unknown>) {
    return {
      ...row,
      navigationUrl: this.googleMapsUrl(row.latitude, row.longitude),
    };
  }

  private haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadius = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * earthRadius * Math.asin(Math.sqrt(a));
  }

  private audit(actor: JwtPayload, action: string, entityId: string, metadata: Record<string, unknown>) {
    return this.auditService.record({
      actor,
      action,
      entityType: "police_stations",
      entityId,
      metadata,
    });
  }
}
