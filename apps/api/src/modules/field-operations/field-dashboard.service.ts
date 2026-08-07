import { Injectable } from "@nestjs/common";
import type { JwtPayload } from "../../common/auth/jwt";
import { DispatchService } from "../dispatch/dispatch.service";
import { PrismaService } from "../prisma/prisma.service";
import { assertFieldSession } from "./field-session.util";
import { FieldCheckpointsService } from "./field-checkpoints.service";
import { FieldPatrolsService } from "./field-patrols.service";
import { FieldShiftsService } from "./field-shifts.service";

@Injectable()
export class FieldDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shifts: FieldShiftsService,
    private readonly patrols: FieldPatrolsService,
    private readonly checkpoints: FieldCheckpointsService,
    private readonly dispatch: DispatchService,
  ) {}

  async getDashboard(actor: JwtPayload) {
    const ctx = assertFieldSession(actor);
    const [officer, device, shiftResult, patrolResult, checkpointResult, assignmentsResult, officerStatus, nearbyBroadcasts] =
      await Promise.all([
        this.prisma.adminUser.findUnique({
          where: { id: ctx.officerId },
          include: { role: true, agency: true, responderProfile: true },
        }),
        this.prisma.fieldDevice.findUnique({ where: { id: ctx.fieldDeviceId } }),
        this.shifts.getActiveShift(actor),
        this.patrols.getActivePatrol(actor),
        this.checkpoints.getActiveCheckpoint(actor),
        this.dispatch.getMyAssignments(actor, { status: "Accepted", limit: "20" }).catch(() => ({ data: [] })),
        this.prisma.officerStatus.findUnique({ where: { officerId: ctx.officerId } }),
        this.prisma.broadcast.findMany({
          where: {
            status: "Published",
            ...(ctx.state ? { state: ctx.state } : {}),
          },
          orderBy: { publishedAt: "desc" },
          take: 5,
          select: { id: true, type: true, title: true, priority: true, publishedAt: true },
        }),
      ]);

    const activeAssignments = Array.isArray(assignmentsResult.data) ? assignmentsResult.data : [];
    const emergencyIncidents = activeAssignments.filter((row: any) =>
      ["P1LifeThreat", "P2Urgent", "P3Elevated"].includes(String(row.priority ?? row.incident?.priority ?? "")),
    );

    return {
      data: {
        officer: officer
          ? {
              id: officer.id,
              displayName: officer.displayName,
              role: officer.role.name,
              fieldRole: ctx.fieldRole ?? null,
              agency: officer.agency ? { id: officer.agency.id, name: officer.agency.name } : null,
            }
          : null,
        assignedUnitId: ctx.assignedUnitId ?? device?.assignedUnitId ?? null,
        shift: shiftResult.data,
        patrol: patrolResult.data,
        checkpoint: checkpointResult.data,
        status: officerStatus
          ? {
              operationalStatus: officerStatus.status,
              latitude: officerStatus.latitude != null ? Number(officerStatus.latitude) : null,
              longitude: officerStatus.longitude != null ? Number(officerStatus.longitude) : null,
              batteryLevel: officerStatus.batteryLevel,
              gpsStatus: officerStatus.gpsStatus,
              radioStatus: officerStatus.radioStatus,
              vehicleIdentifier: officerStatus.vehicleIdentifier,
              droneAvailable: officerStatus.droneAvailable,
              weatherSummary: officerStatus.weatherSummary,
              isOffline: officerStatus.isOffline,
              lastHeartbeatAt: officerStatus.lastHeartbeatAt?.toISOString?.() ?? null,
            }
          : null,
        device: device
          ? {
              publicDeviceId: device.publicDeviceId,
              batteryLevel: device.batteryLevel,
              chargingState: device.chargingState,
              networkType: device.networkType,
              lastSeenAt: device.lastSeenAt?.toISOString?.() ?? null,
              lastKnownLatitude: device.lastKnownLatitude != null ? Number(device.lastKnownLatitude) : null,
              lastKnownLongitude: device.lastKnownLongitude != null ? Number(device.lastKnownLongitude) : null,
            }
          : null,
        counts: {
          activeAssignments: activeAssignments.length,
          emergencyIncidents: emergencyIncidents.length,
          nearbyBroadcasts: nearbyBroadcasts.length,
        },
        quickActions: [
          "startPatrol",
          "startCheckpoint",
          "respondToIncident",
          "assignments",
          "broadcasts",
          "bolo",
          "drone",
          "messages",
          "panic",
          "sos",
        ],
        recentBroadcasts: nearbyBroadcasts.map((row) => ({
          id: row.id,
          type: row.type,
          title: row.title,
          priority: row.priority,
          publishedAt: row.publishedAt?.toISOString?.() ?? null,
        })),
      },
    };
  }

  async updateTelemetry(actor: JwtPayload, dto: {
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    batteryLevel?: number;
    chargingState?: string;
    gpsStatus?: string;
    radioStatus?: string;
    networkType?: string;
    weatherSummary?: string;
    isOffline?: boolean;
  }) {
    const ctx = assertFieldSession(actor);
    const status = await this.prisma.officerStatus.upsert({
      where: { officerId: ctx.officerId },
      create: {
        officerId: ctx.officerId,
        fieldDeviceId: ctx.fieldDeviceId,
        batteryLevel: dto.batteryLevel ?? null,
        chargingState: dto.chargingState ?? null,
        gpsStatus: dto.gpsStatus ?? null,
        radioStatus: dto.radioStatus ?? null,
        networkType: dto.networkType ?? null,
        weatherSummary: dto.weatherSummary ?? null,
        isOffline: dto.isOffline ?? false,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        locationAccuracyMeters: dto.accuracyMeters ?? null,
        locationAt: dto.latitude != null ? new Date() : null,
        lastHeartbeatAt: new Date(),
      },
      update: {
        fieldDeviceId: ctx.fieldDeviceId,
        batteryLevel: dto.batteryLevel,
        chargingState: dto.chargingState,
        gpsStatus: dto.gpsStatus,
        radioStatus: dto.radioStatus,
        networkType: dto.networkType,
        weatherSummary: dto.weatherSummary,
        isOffline: dto.isOffline,
        latitude: dto.latitude,
        longitude: dto.longitude,
        locationAccuracyMeters: dto.accuracyMeters,
        locationAt: dto.latitude != null ? new Date() : undefined,
        lastHeartbeatAt: new Date(),
      },
    });

    if (dto.batteryLevel != null || dto.latitude != null) {
      await this.prisma.fieldDevice.update({
        where: { id: ctx.fieldDeviceId },
        data: {
          batteryLevel: dto.batteryLevel ?? undefined,
          chargingState: dto.chargingState ?? undefined,
          networkType: dto.networkType ?? undefined,
          lastKnownLatitude: dto.latitude ?? undefined,
          lastKnownLongitude: dto.longitude ?? undefined,
          lastLocationAccuracy: dto.accuracyMeters ?? undefined,
          lastLocationAt: dto.latitude != null ? new Date() : undefined,
          lastSeenAt: new Date(),
        },
      });
    }

    return {
      data: {
        status: status.status,
        lastHeartbeatAt: status.lastHeartbeatAt?.toISOString?.() ?? null,
      },
    };
  }
}
