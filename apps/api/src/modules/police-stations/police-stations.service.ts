import { Injectable, NotFoundException } from "@nestjs/common";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { parseNearestQuery, PoliceStationListQuery, PoliceStationSearchQuery, NearestPoliceStationsQuery, UpsertPoliceStationDto, validatePoliceStationDto } from "./dto/police-station.dto";

@Injectable()
export class PoliceStationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
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
          AND ($4::text IS NULL OR ps.agency_type = $4)
        ORDER BY ps.gps_location <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        LIMIT $5`,
      parsed.longitude,
      parsed.latitude,
      parsed.radiusMeters,
      parsed.agencyType ?? null,
      parsed.limit,
    ) as Array<Record<string, unknown>>;
    return { data: rows.map((row) => ({ ...row, navigationUrl: this.googleMapsUrl(row.latitude, row.longitude) })) };
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
    return { data: rows.map((station) => ({ ...station, navigationUrl: this.googleMapsUrl(station.latitude, station.longitude) })) };
  }

  async create(dto: UpsertPoliceStationDto, actor: JwtPayload) {
    validatePoliceStationDto(dto);
    const station = await (this.prisma as any).policeStation.create({
      data: {
        agencyId: dto.agencyId,
        jurisdictionId: dto.jurisdictionId,
        name: dto.name,
        phone: dto.phone,
        address: dto.address,
        agencyType: dto.agencyType,
        latitude: dto.latitude,
        longitude: dto.longitude,
      } as never,
    });
    await this.audit(actor, "police_station.created", station.id, { name: dto.name, agencyType: dto.agencyType });
    return { data: station };
  }

  async update(id: string, dto: UpsertPoliceStationDto, actor: JwtPayload) {
    validatePoliceStationDto(dto);
    const existing = await this.prisma.policeStation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Police station not found");
    const station = await this.prisma.policeStation.update({
      where: { id },
      data: {
        agencyId: dto.agencyId,
        jurisdictionId: dto.jurisdictionId,
        name: dto.name,
        phone: dto.phone,
        address: dto.address,
        agencyType: dto.agencyType,
        latitude: dto.latitude,
        longitude: dto.longitude,
      } as never,
    });
    await this.audit(actor, "police_station.updated", station.id, { before: existing, after: station });
    return { data: station };
  }

  private googleMapsUrl(latitude: unknown, longitude: unknown) {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
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
