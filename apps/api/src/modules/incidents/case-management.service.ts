import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AdminRoleName, IncidentType } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import {
  buildCursorPage,
  dateIdCursorWhere,
  decodeDateIdCursor,
  encodeDateIdCursor,
  resolvePageLimit,
} from "../../common/pagination/cursor-pagination";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  AdminCreateMissingPersonDto,
  AdminCreateStolenVehicleDto,
  ListCaseQuery,
  UpdateMissingPersonCaseDto,
  UpdateStolenVehicleCaseDto,
  validateUpdateMissingPersonCase,
  validateUpdateStolenVehicleCase,
} from "./dto/case-management.dto";
import { IncidentsService } from "./incidents.service";

@Injectable()
export class CaseManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly incidents: IncidentsService,
    private readonly audit: AuditService,
  ) {}

  async listMissingPersonCases(actor: JwtPayload, query: ListCaseQuery = {}) {
    this.assertAdmin(actor);
    return this.listCases(actor, IncidentType.MissingPerson, query, "missingPersonReport");
  }

  async listStolenVehicleCases(actor: JwtPayload, query: ListCaseQuery = {}) {
    this.assertAdmin(actor);
    return this.listCases(actor, IncidentType.StolenVehicle, query, "stolenVehicleReport");
  }

  async getMissingPersonCase(incidentId: string, actor: JwtPayload) {
    this.assertAdmin(actor);
    const incident = await this.incidents.get(incidentId, actor);
    if (incident.type !== IncidentType.MissingPerson) throw new NotFoundException("Missing person case not found");
    const report = await this.prisma.missingPersonReport.findFirst({ where: { incidentId } });
    return { data: { incident, report } };
  }

  async getStolenVehicleCase(incidentId: string, actor: JwtPayload) {
    this.assertAdmin(actor);
    const incident = await this.incidents.get(incidentId, actor);
    if (incident.type !== IncidentType.StolenVehicle) throw new NotFoundException("Stolen vehicle case not found");
    const report = await this.prisma.stolenVehicleReport.findFirst({
      where: { incidentId },
      include: { vehicle: true },
    });
    return { data: { incident, report } };
  }

  async updateMissingPersonCase(incidentId: string, dto: UpdateMissingPersonCaseDto, actor: JwtPayload) {
    this.assertAdmin(actor);
    validateUpdateMissingPersonCase(dto);
    await this.getMissingPersonCase(incidentId, actor);
    const report = await this.prisma.missingPersonReport.findFirst({ where: { incidentId } });
    if (!report) throw new NotFoundException("Missing person report not found");

    const updated = await this.prisma.missingPersonReport.update({
      where: { id: report.id },
      data: {
        ...(dto.fullName?.trim() ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.age !== undefined ? { age: dto.age } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.lastSeenAt ? { lastSeenAt: new Date(dto.lastSeenAt) } : {}),
        ...(dto.lastSeenAddress !== undefined ? { lastSeenAddress: dto.lastSeenAddress } : {}),
        ...(dto.reportStatus ? { status: dto.reportStatus } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      } as never,
    });

    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE missing_person_reports SET gps_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE id = $3::uuid`,
        dto.longitude,
        dto.latitude,
        report.id,
      );
    }

    await this.audit.record({
      actor,
      action: "case.missing_person_updated",
      entityType: "missing_person_reports",
      entityId: report.id,
      metadata: { incidentId, reportStatus: dto.reportStatus },
    });
    return this.getMissingPersonCase(incidentId, actor);
  }

  async updateStolenVehicleCase(incidentId: string, dto: UpdateStolenVehicleCaseDto, actor: JwtPayload) {
    this.assertAdmin(actor);
    validateUpdateStolenVehicleCase(dto);
    const detail = await this.getStolenVehicleCase(incidentId, actor);
    const report = detail.data.report;
    if (!report) throw new NotFoundException("Stolen vehicle report not found");

    if (dto.plateNumber || dto.vin || dto.make || dto.model || dto.color || dto.year !== undefined) {
      await this.prisma.vehicle.update({
        where: { id: report.vehicleId },
        data: {
          ...(dto.plateNumber?.trim() ? { plateNumber: dto.plateNumber.trim() } : {}),
          ...(dto.vin !== undefined ? { vin: dto.vin } : {}),
          ...(dto.make?.trim() ? { make: dto.make.trim() } : {}),
          ...(dto.model?.trim() ? { model: dto.model.trim() } : {}),
          ...(dto.color !== undefined ? { color: dto.color } : {}),
          ...(dto.year !== undefined ? { year: dto.year } : {}),
        } as never,
      });
    }

    await this.prisma.stolenVehicleReport.update({
      where: { id: report.id },
      data: {
        ...(dto.lastSeenAt ? { lastSeenAt: new Date(dto.lastSeenAt) } : {}),
        ...(dto.lastSeenArea !== undefined ? { lastSeenArea: dto.lastSeenArea } : {}),
        ...(dto.reportStatus ? { status: dto.reportStatus } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      } as never,
    });

    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE stolen_vehicle_reports SET gps_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE id = $3::uuid`,
        dto.longitude,
        dto.latitude,
        report.id,
      );
    }

    await this.audit.record({
      actor,
      action: "case.stolen_vehicle_updated",
      entityType: "stolen_vehicle_reports",
      entityId: report.id,
      metadata: { incidentId, reportStatus: dto.reportStatus },
    });
    return this.getStolenVehicleCase(incidentId, actor);
  }

  async createMissingPersonCase(dto: AdminCreateMissingPersonDto, actor: JwtPayload) {
    this.assertAdmin(actor);
    const created = await this.incidents.report(
      {
        type: IncidentType.MissingPerson,
        title: dto.title ?? `Missing person: ${dto.missingPerson.fullName}`,
        description: dto.description ?? dto.missingPerson.description ?? "Missing person report",
        latitude: dto.latitude,
        longitude: dto.longitude,
        manualLatitude: dto.manualLatitude,
        manualLongitude: dto.manualLongitude,
        manualAddress: dto.manualAddress,
        address: dto.address,
        priority: dto.priority,
        occurredAt: dto.occurredAt,
        media: dto.media,
        missingPerson: dto.missingPerson,
      },
      actor,
    );
    return this.getMissingPersonCase(String(created.id), actor);
  }

  async createStolenVehicleCase(dto: AdminCreateStolenVehicleDto, actor: JwtPayload) {
    this.assertAdmin(actor);
    const created = await this.incidents.report(
      {
        type: IncidentType.StolenVehicle,
        title: dto.title ?? `Stolen vehicle: ${dto.stolenVehicle.plateNumber}`,
        description: dto.description ?? `Stolen vehicle report for ${dto.stolenVehicle.plateNumber}`,
        latitude: dto.latitude,
        longitude: dto.longitude,
        manualLatitude: dto.manualLatitude,
        manualLongitude: dto.manualLongitude,
        manualAddress: dto.manualAddress,
        address: dto.address,
        priority: dto.priority,
        occurredAt: dto.occurredAt,
        media: dto.media,
        stolenVehicle: dto.stolenVehicle,
      },
      actor,
    );
    return this.getStolenVehicleCase(String(created.id), actor);
  }

  private async listCases(
    actor: JwtPayload,
    type: IncidentType,
    query: ListCaseQuery,
    reportKind: "missingPersonReport" | "stolenVehicleReport",
  ) {
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    let incidentIds: string[] | undefined;

    if (query.reportStatus?.trim() || query.q?.trim()) {
      if (reportKind === "missingPersonReport") {
        const reports = await this.prisma.missingPersonReport.findMany({
          where: {
            ...(query.reportStatus?.trim() ? { status: query.reportStatus.trim() } : {}),
            ...(query.q?.trim()
              ? {
                  OR: [
                    { fullName: { contains: query.q.trim(), mode: "insensitive" } },
                    { description: { contains: query.q.trim(), mode: "insensitive" } },
                  ],
                }
              : {}),
          } as never,
          select: { incidentId: true },
        });
        incidentIds = reports.map((row) => row.incidentId).filter((id): id is string => Boolean(id));
      } else {
        const reports = await this.prisma.stolenVehicleReport.findMany({
          where: {
            ...(query.reportStatus?.trim() ? { status: query.reportStatus.trim() } : {}),
            ...(query.q?.trim()
              ? {
                  vehicle: {
                    OR: [
                      { plateNumber: { contains: query.q.trim(), mode: "insensitive" } },
                      { vin: { contains: query.q.trim(), mode: "insensitive" } },
                      { make: { contains: query.q.trim(), mode: "insensitive" } },
                      { model: { contains: query.q.trim(), mode: "insensitive" } },
                    ],
                  },
                }
              : {}),
          } as never,
          select: { incidentId: true },
        });
        incidentIds = reports.map((row) => row.incidentId).filter((id): id is string => Boolean(id));
      }
      if (!incidentIds.length) {
        return { data: [], nextCursor: null, hasMore: false, limit };
      }
    }

    const rows = await this.prisma.incident.findMany({
      where: {
        ...this.incidentScopeWhere(actor),
        type: type as never,
        ...(query.status?.trim() ? { status: query.status.trim() as never } : {}),
        ...(query.priority?.trim() ? { priority: query.priority.trim() as never } : {}),
        ...(incidentIds ? { id: { in: incidentIds } } : {}),
        ...dateIdCursorWhere(cursor),
      } as never,
      include: {
        media: { take: 3 },
        timeline: { orderBy: { createdAt: "desc" }, take: 3 },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const page = buildCursorPage(rows, limit, (item) => encodeDateIdCursor(item.createdAt, item.id));
    const ids = page.data.map((incident) => incident.id);
    const reports =
      reportKind === "missingPersonReport"
        ? await this.prisma.missingPersonReport.findMany({ where: { incidentId: { in: ids } } })
        : await this.prisma.stolenVehicleReport.findMany({ where: { incidentId: { in: ids } }, include: { vehicle: true } });
    const reportByIncident = new Map(
      reports
        .filter((report) => Boolean(report.incidentId))
        .map((report) => [report.incidentId as string, report]),
    );

    return {
      ...page,
      data: page.data.map((incident) => ({
        incident,
        report: reportByIncident.get(incident.id) ?? null,
      })),
    };
  }

  private assertAdmin(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin authentication required");
  }

  private incidentScopeWhere(actor?: JwtPayload) {
    if (!actor) return { id: "__deny_all__" };
    if (actor.typ === "user") return { reporterId: actor.sub };
    if (actor.role === AdminRoleName.SuperAdmin) return {};
    if (actor.role === AdminRoleName.CountryAdmin) return { country: actor.country };
    if (actor.role === AdminRoleName.StateAdmin) return { country: actor.country, state: actor.state };
    if (actor.role === AdminRoleName.LgaAdmin || actor.role === AdminRoleName.CallCenterAgent || actor.role === AdminRoleName.OversightAuditor) {
      return { country: actor.country, state: actor.state, lga: actor.lga };
    }
    if (actor.role === AdminRoleName.AgencyAdmin || actor.role === AdminRoleName.PoliceSecurityOfficer) {
      return { assignedAgencyId: actor.agencyId ?? "__no_agency__" };
    }
    return { id: "__deny_all__" };
  }
}
