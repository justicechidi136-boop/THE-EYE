import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { LocationListQueryDto, LocationSearchQueryDto } from "./dto/location-query.dto";

const pageMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
  hasPrevious: page > 1,
  hasNext: page * limit < total,
});

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listStates(countryCode: string, query: LocationListQueryDto) {
    const country = await this.prisma.country.findFirst({
      where: { code: countryCode.toUpperCase(), isActive: true },
    });
    if (!country) throw new NotFoundException("Country not found");
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = {
      countryId: country.id,
      isActive: true,
      ...(query.q?.trim()
        ? {
            OR: [
              { name: { contains: query.q.trim(), mode: "insensitive" as const } },
              { officialName: { contains: query.q.trim(), mode: "insensitive" as const } },
              { aliases: { has: query.q.trim() } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.administrativeState.findMany({
        where,
        select: { id: true, code: true, name: true, officialName: true, type: true, slug: true },
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.administrativeState.count({ where }),
    ]);
    return { data, pagination: pageMeta(page, limit, total) };
  }

  async listLgas(stateId: string, query: LocationListQueryDto) {
    const state = await this.prisma.administrativeState.findFirst({
      where: { id: stateId, isActive: true },
      select: { id: true, name: true, country: { select: { code: true, name: true } } },
    });
    if (!state) throw new NotFoundException("State/FCT not found");
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = {
      stateId,
      isActive: true,
      ...(query.q?.trim()
        ? {
            OR: [
              { name: { contains: query.q.trim(), mode: "insensitive" as const } },
              { officialName: { contains: query.q.trim(), mode: "insensitive" as const } },
              { aliases: { has: query.q.trim() } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.localGovernmentArea.findMany({
        where,
        select: { id: true, code: true, name: true, officialName: true, type: true, slug: true },
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.localGovernmentArea.count({ where }),
    ]);
    return {
      data: rows.map((row) => ({ ...row, state: state.name, country: state.country.name })),
      pagination: pageMeta(page, limit, total),
    };
  }

  async listWards(lgaId: string, query: LocationListQueryDto) {
    const lga = await this.prisma.localGovernmentArea.findFirst({
      where: { id: lgaId, isActive: true },
      select: {
        id: true,
        name: true,
        state: { select: { name: true, country: { select: { name: true } } } },
      },
    });
    if (!lga) throw new NotFoundException("LGA/Area Council not found");
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = {
      lgaId,
      isActive: true,
      ...(query.q?.trim()
        ? {
            OR: [
              { name: { contains: query.q.trim(), mode: "insensitive" as const } },
              { officialName: { contains: query.q.trim(), mode: "insensitive" as const } },
              { aliases: { has: query.q.trim() } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.ward.findMany({
        where,
        select: { id: true, code: true, name: true, officialName: true, slug: true },
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ward.count({ where }),
    ]);
    return {
      data: rows.map((row) => ({
        ...row,
        lga: lga.name,
        state: lga.state.name,
        country: lga.state.country.name,
      })),
      pagination: pageMeta(page, limit, total),
    };
  }

  async search(query: LocationSearchQueryDto) {
    const q = query.q.trim();
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const nameWhere = {
      isActive: true,
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { officialName: { contains: q, mode: "insensitive" as const } },
        { aliases: { has: q } },
      ],
    };
    const [states, lgas, wards, stateCount, lgaCount, wardCount] = await Promise.all([
      this.prisma.administrativeState.findMany({
        where: nameWhere,
        include: { country: { select: { name: true } } },
        orderBy: { name: "asc" },
        take: limit + skip,
      }),
      this.prisma.localGovernmentArea.findMany({
        where: nameWhere,
        include: { state: { include: { country: { select: { name: true } } } } },
        orderBy: { name: "asc" },
        take: limit + skip,
      }),
      this.prisma.ward.findMany({
        where: nameWhere,
        include: {
          lga: { include: { state: { include: { country: { select: { name: true } } } } } },
        },
        orderBy: { name: "asc" },
        take: limit + skip,
      }),
      this.prisma.administrativeState.count({ where: nameWhere }),
      this.prisma.localGovernmentArea.count({ where: nameWhere }),
      this.prisma.ward.count({ where: nameWhere }),
    ]);
    const results = [
      ...states.map((state) => ({
        id: state.id,
        type: state.type === "FCT" ? "FCT" : "STATE",
        name: state.name,
        hierarchy: { country: state.country.name },
      })),
      ...lgas.map((lga) => ({
        id: lga.id,
        type: lga.type,
        name: lga.name,
        hierarchy: { state: lga.state.name, country: lga.state.country.name },
      })),
      ...wards.map((ward) => ({
        id: ward.id,
        type: "WARD",
        name: ward.name,
        hierarchy: {
          lga: ward.lga.name,
          state: ward.lga.state.name,
          country: ward.lga.state.country.name,
        },
      })),
    ];
    const data = results.slice(skip, skip + limit);
    return { data, pagination: pageMeta(page, limit, stateCount + lgaCount + wardCount) };
  }
}
