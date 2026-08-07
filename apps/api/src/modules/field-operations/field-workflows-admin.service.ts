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

  async monitoringSummary(actor: JwtPayload, query: { agencyId?: string; state?: string; status?: string } = {}) {
    this.assertMonitor(actor);
    const agencyId = query.agencyId ?? actor.agencyId ?? undefined;
    const where = agencyId ? { agencyId } : {};
    const officerWhere = agencyId
      ? { officer: { agencyId } }
      : query.state || actor.state
        ? { officer: { state: query.state ?? actor.state } }
        : {};

    const [
      activeShifts,
      activePatrols,
      activeCheckpoints,
      officerStatuses,
      offlineOfficers,
      backupRequests,
      safetyAlerts,
      syncStates,
      revokedDevices,
    ] = await Promise.all([
      this.prisma.fieldShift.count({ where: { ...where, status: "Active" } }),
      this.prisma.patrolSession.count({ where: { ...where, status: "Active" } }),
      this.prisma.checkpointSession.count({ where: { ...where, status: "Active" } }),
      this.prisma.officerStatus.findMany({
        where: officerWhere,
        include: {
          officer: { select: { id: true, displayName: true, agencyId: true, state: true, lga: true } },
          fieldDevice: {
            select: {
              id: true,
              publicDeviceId: true,
              isRevoked: true,
              isLost: true,
              appVersion: true,
              batteryLevel: true,
              lastSeenAt: true,
            },
          },
        },
        orderBy: { lastHeartbeatAt: "desc" },
        take: 100,
      }),
      this.prisma.officerStatus.count({ where: { ...officerWhere, isOffline: true } }),
      this.prisma.fieldBackupRequest.findMany({
        where: {
          ...(agencyId ? { agencyId } : {}),
          status: { in: ["Requested", "Acknowledged", "Assigned", "EnRoute"] },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { officer: { select: { id: true, displayName: true } } },
      }),
      this.prisma.fieldOfficerSafetyAlert.findMany({
        where: {
          ...(agencyId ? { agencyId } : {}),
          status: { in: ["Active", "Acknowledged"] },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { officer: { select: { id: true, displayName: true } } },
      }),
      this.prisma.fieldDeviceSyncState.findMany({
        where: agencyId
          ? { fieldDevice: { agencyId } }
          : actor.state
            ? { fieldDevice: { assignedUser: { state: actor.state } } }
            : {},
        take: 100,
        include: { fieldDevice: { select: { id: true, publicDeviceId: true, agencyId: true } } },
      }),
      this.prisma.fieldDevice.count({
        where: {
          ...(agencyId ? { agencyId } : {}),
          OR: [{ isRevoked: true }, { isLost: true }],
        },
      }),
    ]);

    const syncByDevice = new Map(syncStates.map((row) => [row.fieldDeviceId, row]));

    return {
      data: {
        counts: {
          activeShifts,
          activePatrols,
          activeCheckpoints,
          offlineOfficers,
          openBackupRequests: backupRequests.length,
          activeSafetyAlerts: safetyAlerts.length,
          revokedOrLostDevices: revokedDevices,
          syncBacklog: syncStates.reduce((sum, row) => sum + row.offlineQueueDepth, 0),
        },
        officers: officerStatuses.map((row) => {
          const sync = row.fieldDeviceId ? syncByDevice.get(row.fieldDeviceId) : null;
          const device = row.fieldDevice;
          const riskFlags: string[] = [];
          if (row.isOffline) riskFlags.push("offline");
          if ((row.batteryLevel ?? 100) <= 15) riskFlags.push("low_battery");
          if (row.gpsStatus === "unavailable") riskFlags.push("gps_unavailable");
          if ((sync?.offlineQueueDepth ?? 0) > 10) riskFlags.push("sync_backlog");
          if (device?.isRevoked || device?.isLost) riskFlags.push("device_revoked");
          if (row.status === "Panic") riskFlags.push("officer_safety");
          return {
            officerId: row.officerId,
            displayName: row.officer.displayName,
            agencyId: row.officer.agencyId,
            state: row.officer.state,
            lga: row.officer.lga,
            status: row.status,
            batteryLevel: row.batteryLevel,
            gpsStatus: row.gpsStatus,
            latitude: row.latitude != null ? Number(row.latitude) : null,
            longitude: row.longitude != null ? Number(row.longitude) : null,
            activeAssignmentCount: row.activeAssignmentCount,
            isOffline: row.isOffline,
            lastHeartbeatAt: row.lastHeartbeatAt?.toISOString?.() ?? null,
            fieldDeviceId: row.fieldDeviceId,
            appVersion: device?.appVersion ?? null,
            offlineQueueDepth: sync?.offlineQueueDepth ?? 0,
            deadLetterCount: sync?.deadLetterCount ?? 0,
            riskFlags,
          };
        }),
        backupRequests: backupRequests.map((row) => ({
          id: row.id,
          requestType: row.requestType,
          status: row.status,
          priority: row.priority,
          officerName: row.officer.displayName,
          latitude: row.latitude != null ? Number(row.latitude) : null,
          longitude: row.longitude != null ? Number(row.longitude) : null,
          createdAt: row.createdAt.toISOString(),
        })),
        safetyAlerts: safetyAlerts.map((row) => ({
          id: row.id,
          alertType: row.alertType,
          status: row.status,
          officerName: row.officer.displayName,
          latitude: row.latitude != null ? Number(row.latitude) : null,
          longitude: row.longitude != null ? Number(row.longitude) : null,
          createdAt: row.createdAt.toISOString(),
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
