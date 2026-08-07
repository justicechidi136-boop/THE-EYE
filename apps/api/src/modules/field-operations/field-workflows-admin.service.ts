import { ForbiddenException, Injectable } from "@nestjs/common";
import { canApproveFieldDevices } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { resolvePageLimit } from "./field-session.util";
import { FieldCheckpointsService } from "./field-checkpoints.service";
import { FieldPatrolsService } from "./field-patrols.service";
import { FieldShiftsService } from "./field-shifts.service";

@Injectable()
export class FieldWorkflowsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shifts: FieldShiftsService,
    private readonly patrols: FieldPatrolsService,
    private readonly checkpoints: FieldCheckpointsService,
  ) {}

  private assertMonitor(actor: JwtPayload) {
    if (actor.typ !== "admin" || !canApproveFieldDevices(actor.role ?? "")) {
      throw new ForbiddenException("Field operations monitoring requires supervisor access");
    }
  }

  async monitoringSummary(actor: JwtPayload, query: { agencyId?: string } = {}) {
    this.assertMonitor(actor);
    const agencyId = query.agencyId ?? actor.agencyId ?? undefined;
    const where = agencyId ? { agencyId } : {};

    const [activeShifts, activePatrols, activeCheckpoints, officerStatuses, offlineOfficers] = await Promise.all([
      this.prisma.fieldShift.count({ where: { ...where, status: "Active" } }),
      this.prisma.patrolSession.count({ where: { ...where, status: "Active" } }),
      this.prisma.checkpointSession.count({ where: { ...where, status: "Active" } }),
      this.prisma.officerStatus.findMany({
        where: agencyId
          ? { officer: { agencyId } }
          : actor.state
            ? { officer: { state: actor.state } }
            : {},
        include: { officer: { select: { id: true, displayName: true, agencyId: true } }, fieldDevice: true },
        orderBy: { lastHeartbeatAt: "desc" },
        take: 100,
      }),
      this.prisma.officerStatus.count({ where: { ...(agencyId ? { officer: { agencyId } } : {}), isOffline: true } }),
    ]);

    return {
      data: {
        counts: {
          activeShifts,
          activePatrols,
          activeCheckpoints,
          offlineOfficers,
        },
        officers: officerStatuses.map((row) => ({
          officerId: row.officerId,
          displayName: row.officer.displayName,
          status: row.status,
          batteryLevel: row.batteryLevel,
          gpsStatus: row.gpsStatus,
          latitude: row.latitude != null ? Number(row.latitude) : null,
          longitude: row.longitude != null ? Number(row.longitude) : null,
          activeAssignmentCount: row.activeAssignmentCount,
          isOffline: row.isOffline,
          lastHeartbeatAt: row.lastHeartbeatAt?.toISOString?.() ?? null,
          fieldDeviceId: row.fieldDeviceId,
        })),
      },
    };
  }

  async listPatrols(actor: JwtPayload, query: { agencyId?: string; limit?: string } = {}) {
    this.assertMonitor(actor);
    const rows = await this.prisma.patrolSession.findMany({
      where: {
        ...(query.agencyId ? { agencyId: query.agencyId } : actor.agencyId ? { agencyId: actor.agencyId } : {}),
        status: { in: ["Active", "Paused"] },
      },
      include: { officer: { select: { id: true, displayName: true } } },
      orderBy: { startedAt: "desc" },
      take: resolvePageLimit(query.limit),
    });
    return { data: rows.map((row) => this.patrols.mapPatrol(row)) };
  }

  async listCheckpoints(actor: JwtPayload, query: { agencyId?: string; limit?: string } = {}) {
    this.assertMonitor(actor);
    const rows = await this.prisma.checkpointSession.findMany({
      where: {
        ...(query.agencyId ? { agencyId: query.agencyId } : actor.agencyId ? { agencyId: actor.agencyId } : {}),
        status: { in: ["Active", "Paused"] },
      },
      include: { officer: { select: { id: true, displayName: true } } },
      orderBy: { startedAt: "desc" },
      take: resolvePageLimit(query.limit),
    });
    return { data: rows.map((row) => this.checkpoints.mapCheckpoint(row)) };
  }

  async listShifts(actor: JwtPayload, query: { agencyId?: string; limit?: string } = {}) {
    this.assertMonitor(actor);
    const rows = await this.prisma.fieldShift.findMany({
      where: {
        ...(query.agencyId ? { agencyId: query.agencyId } : actor.agencyId ? { agencyId: actor.agencyId } : {}),
        status: { in: ["PendingApproval", "Active", "Paused"] },
      },
      include: { officer: { select: { id: true, displayName: true } }, assignedUnit: true, agency: true },
      orderBy: { createdAt: "desc" },
      take: resolvePageLimit(query.limit),
    });
    return { data: rows.map((row) => this.shifts.mapShift(row)) };
  }
}
