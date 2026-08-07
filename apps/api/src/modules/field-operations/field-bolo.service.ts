import { Injectable } from "@nestjs/common";
import { OperationalSightingStatus } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { FieldBoloSearchDto, OperationalSightingDto } from "./dto/field-workflows.dto";
import { validateOperationalSightingDto } from "./dto/field-workflows.dto";
import { assertFieldSession, decimalOrNull, resolvePageLimit } from "./field-session.util";

@Injectable()
export class FieldBoloService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async search(actor: JwtPayload, query: FieldBoloSearchDto) {
    const ctx = assertFieldSession(actor);
    const q = query.q?.trim();
    const limit = resolvePageLimit(query.limit, 25, 100);

    const [broadcasts, sightings] = await Promise.all([
      this.prisma.broadcast.findMany({
        where: {
          status: "Published",
          ...(ctx.state ? { state: ctx.state } : {}),
          ...(ctx.lga ? { lga: ctx.lga } : {}),
          type: {
            in: ["MissingPerson", "StolenVehicle"] as never[],
          },
          ...(query.sightingType && query.sightingType === "MissingPerson"
            ? { type: "MissingPerson" as never }
            : query.sightingType === "WantedVehicle"
              ? { type: "StolenVehicle" as never }
              : {}),
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { body: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { publishedAt: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          priority: true,
          publishedAt: true,
          metadata: true,
        },
      }),
      this.prisma.operationalSighting.findMany({
        where: {
          agencyId: ctx.agencyId ?? undefined,
          status: { in: [OperationalSightingStatus.Open, OperationalSightingStatus.Acknowledged] },
          ...(query.sightingType ? { sightingType: query.sightingType } : {}),
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
                  { searchQuery: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    return {
      data: {
        missingPersons: broadcasts.filter((row) => row.type === "MissingPerson").map((row) => this.mapBroadcast(row)),
        wantedVehicles: broadcasts.filter((row) => row.type === "StolenVehicle").map((row) => this.mapBroadcast(row)),
        operationalSightings: sightings.map((row) => this.mapSighting(row)),
      },
    };
  }

  async createSighting(actor: JwtPayload, dto: OperationalSightingDto) {
    validateOperationalSightingDto(dto);
    const ctx = assertFieldSession(actor);
    if (!ctx.agencyId) throw new ForbiddenException("Agency required for operational sightings");

    if (dto.clientActionId) {
      const duplicate = await this.prisma.operationalSighting.findUnique({ where: { clientActionId: dto.clientActionId } });
      if (duplicate) return { data: this.mapSighting(duplicate) };
    }

    const sighting = await this.prisma.operationalSighting.create({
      data: {
        officerId: ctx.officerId,
        fieldDeviceId: ctx.fieldDeviceId,
        agencyId: ctx.agencyId,
        broadcastId: dto.broadcastId ?? null,
        sightingType: dto.sightingType,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        searchQuery: dto.searchQuery?.trim() || null,
        latitude: decimalOrNull(dto.latitude),
        longitude: decimalOrNull(dto.longitude),
        distanceMeters: dto.distanceMeters ?? null,
        clientActionId: dto.clientActionId ?? null,
        syncedAt: new Date(),
      },
    });

    await this.audit.record({
      actor,
      action: "field.bolo.sighting_created",
      entityType: "operational_sightings",
      entityId: sighting.id,
      metadata: { sightingType: sighting.sightingType, private: true },
    });

    return { data: this.mapSighting(sighting) };
  }

  private mapBroadcast(row: any) {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      summary: String(row.body ?? "").slice(0, 280),
      priority: row.priority,
      publishedAt: row.publishedAt?.toISOString?.() ?? null,
      metadata: row.metadata ?? {},
    };
  }

  private mapSighting(row: any) {
    return {
      id: row.id,
      sightingType: row.sightingType,
      status: row.status,
      title: row.title,
      description: row.description,
      broadcastId: row.broadcastId,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      distanceMeters: row.distanceMeters,
      createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    };
  }
}
