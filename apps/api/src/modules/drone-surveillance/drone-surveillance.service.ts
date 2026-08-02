import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { JwtPayload } from "../../common/auth/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  CreateDroneDeviceDto,
  CreateDroneGeofenceDto,
  CreateDroneMissionDto,
  CreateDroneNoFlyZoneDto,
  CreateDroneOperatorDto,
  LaunchMissionFromIncidentDto,
  LinkDroneEvidenceDto,
  UpdateDroneMissionStatusDto,
  validateCreateDroneDeviceDto,
  validateCreateDroneGeofenceDto,
  validateCreateDroneMissionDto,
  validateCreateDroneNoFlyZoneDto,
  validateCreateDroneOperatorDto,
  validateLaunchMissionFromIncidentDto,
  validateLinkDroneEvidenceDto,
  validateUpdateDroneMissionStatusDto,
} from "./dto/drone-surveillance.dto";

@Injectable()
export class DroneSurveillanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async adminDashboard(_actor: JwtPayload) {
    const [fleet, activeMissions, scheduledMissions, evidenceCount, operators, geofences, noFlyZones] =
      await Promise.all([
        (this.prisma as any).droneDevice.count({ where: { isActive: true } }),
        (this.prisma as any).droneMission.count({ where: { status: { in: ["Active", "Preflight", "Paused"] } } }),
        (this.prisma as any).droneMission.count({ where: { status: "Scheduled" } }),
        (this.prisma as any).droneEvidence.count(),
        (this.prisma as any).droneOperator.count({ where: { isActive: true } }),
        (this.prisma as any).droneGeofence.count({ where: { isActive: true } }),
        (this.prisma as any).droneNoFlyZone.count({ where: { isActive: true } }),
      ]);

    const liveVideoMissions = await (this.prisma as any).droneMission.count({
      where: { liveVideoStatus: "Live" },
    });

    return {
      data: {
        fleetActive: fleet,
        activeMissions,
        scheduledMissions,
        liveVideoStreams: liveVideoMissions,
        evidenceItems: evidenceCount,
        activeOperators: operators,
        geofences,
        noFlyZones,
      },
    };
  }

  async adminListFleet(_actor: JwtPayload) {
    const devices = await (this.prisma as any).droneDevice.findMany({
      orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
    return { data: devices.map((device: any) => this.mapDevice(device)) };
  }

  async adminGetFleetDevice(id: string, _actor: JwtPayload) {
    const device = await (this.prisma as any).droneDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException("Drone not found");
    return { data: this.mapDevice(device) };
  }

  async adminCreateDevice(dto: CreateDroneDeviceDto, actor: JwtPayload) {
    validateCreateDroneDeviceDto(dto);
    const device = await (this.prisma as any).droneDevice.create({
      data: {
        deviceId: dto.deviceId.trim(),
        model: dto.model.trim(),
        manufacturer: dto.manufacturer?.trim(),
        serialNumber: dto.serialNumber?.trim(),
        liveVideoCapable: dto.liveVideoCapable ?? true,
      },
    });
    await this.audit(actor, "drone.device_created", "drone_devices", device.id, { deviceId: device.deviceId });
    return { data: this.mapDevice(device) };
  }

  async adminListMissions(status?: string, _actor?: JwtPayload) {
    const where = status ? { status } : {};
    const missions = await (this.prisma as any).droneMission.findMany({
      where,
      include: {
        drone: true,
        operator: true,
        commander: true,
        incident: { select: { id: true, title: true, status: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    });
    return { data: missions.map((mission: any) => this.mapMission(mission)) };
  }

  async adminGetMission(id: string, _actor: JwtPayload) {
    const mission = await (this.prisma as any).droneMission.findUnique({
      where: { id },
      include: {
        drone: true,
        operator: true,
        commander: true,
        incident: { select: { id: true, title: true, status: true, latitude: true, longitude: true } },
        gpsTracks: { orderBy: { capturedAt: "desc" }, take: 100 },
        evidence: { orderBy: { capturedAt: "desc" }, take: 50 },
        flightLogs: { orderBy: { recordedAt: "desc" }, take: 100 },
      },
    });
    if (!mission) throw new NotFoundException("Mission not found");
    return { data: this.mapMission(mission, true) };
  }

  async adminCreateMission(dto: CreateDroneMissionDto, actor: JwtPayload) {
    validateCreateDroneMissionDto(dto);
    const mission = await this.createMissionRecord(dto, actor.sub);
    await this.audit(actor, "drone.mission_created", "drone_missions", mission.id, {
      missionCode: mission.missionCode,
      incidentId: mission.incidentId,
    });
    return { data: this.mapMission(mission) };
  }

  async adminLaunchFromIncident(dto: LaunchMissionFromIncidentDto, actor: JwtPayload) {
    validateLaunchMissionFromIncidentDto(dto);
    const incident = await this.prisma.incident.findUnique({ where: { id: dto.incidentId } });
    if (!incident) throw new NotFoundException("Incident not found");

    const lat = incident.latitude ? Number(incident.latitude) : incident.manualLatitude ? Number(incident.manualLatitude) : undefined;
    const lng = incident.longitude ? Number(incident.longitude) : incident.manualLongitude ? Number(incident.manualLongitude) : undefined;

    const mission = await this.createMissionRecord(
      {
        title: dto.title ?? `Incident response — ${incident.title}`,
        description: dto.description ?? incident.description ?? undefined,
        priority: dto.priority ?? "P2",
        droneId: dto.droneId,
        incidentId: incident.id,
        targetLatitude: lat,
        targetLongitude: lng,
        targetAddress: incident.address ?? undefined,
      },
      actor.sub,
    );

    await this.prisma.incidentTimeline.create({
      data: {
        incidentId: incident.id,
        actorType: "admin",
        eventType: "drone_mission_launched",
        message: `Drone mission ${mission.missionCode} created for aerial surveillance`,
        metadata: { missionId: mission.id, missionCode: mission.missionCode },
      },
    });

    await this.audit(actor, "drone.mission_launched_from_incident", "drone_missions", mission.id, {
      incidentId: incident.id,
      missionCode: mission.missionCode,
    });

    return { data: this.mapMission(mission) };
  }

  async adminUpdateMissionStatus(id: string, dto: UpdateDroneMissionStatusDto, actor: JwtPayload) {
    validateUpdateDroneMissionStatusDto(dto);
    const existing = await (this.prisma as any).droneMission.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Mission not found");

    const now = new Date();
    const patch: Record<string, unknown> = {
      status: dto.status,
      ...(dto.liveVideoStatus ? { liveVideoStatus: dto.liveVideoStatus } : {}),
    };
    if (dto.status === "Active" && !existing.launchedAt) patch.launchedAt = now;
    if (["Completed", "Aborted", "Failed"].includes(dto.status)) patch.completedAt = now;

    const mission = await (this.prisma as any).droneMission.update({
      where: { id },
      data: patch,
      include: { drone: true, incident: { select: { id: true, title: true } } },
    });

    if (mission.droneId) {
      await (this.prisma as any).droneFlightLog.create({
        data: {
          droneId: mission.droneId,
          missionId: mission.id,
          eventType: "status_change",
          message: `Mission status updated to ${dto.status}`,
          metadata: { previousStatus: existing.status, liveVideoStatus: dto.liveVideoStatus ?? existing.liveVideoStatus },
        },
      });
    }

    await this.audit(actor, "drone.mission_status_updated", "drone_missions", mission.id, {
      status: dto.status,
      liveVideoStatus: dto.liveVideoStatus,
    });

    return { data: this.mapMission(mission) };
  }

  async adminListOperators(_actor: JwtPayload) {
    const operators = await (this.prisma as any).droneOperator.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      take: 200,
    });
    return { data: operators };
  }

  async adminCreateOperator(dto: CreateDroneOperatorDto, actor: JwtPayload) {
    validateCreateDroneOperatorDto(dto);
    const operator = await (this.prisma as any).droneOperator.create({
      data: {
        name: dto.name.trim(),
        email: dto.email?.trim(),
        callsign: dto.callsign?.trim(),
        operatorRole: dto.operatorRole ?? "Operator",
        certificationLevel: dto.certificationLevel?.trim(),
        adminUserId: dto.adminUserId,
      },
    });
    await this.audit(actor, "drone.operator_created", "drone_operators", operator.id, { name: operator.name });
    return { data: operator };
  }

  async adminFlightHistory(_actor: JwtPayload) {
    const missions = await (this.prisma as any).droneMission.findMany({
      where: { status: { in: ["Completed", "Aborted", "Failed"] } },
      include: { drone: true, incident: { select: { id: true, title: true } } },
      orderBy: { completedAt: "desc" },
      take: 200,
    });
    return { data: missions.map((mission: any) => this.mapMission(mission)) };
  }

  async adminFlightLogs(_actor: JwtPayload) {
    const logs = await (this.prisma as any).droneFlightLog.findMany({
      include: { drone: { select: { deviceId: true, model: true } }, mission: { select: { missionCode: true, title: true } } },
      orderBy: { recordedAt: "desc" },
      take: 300,
    });
    return { data: logs };
  }

  async adminListEvidence(_actor: JwtPayload) {
    const evidence = await (this.prisma as any).droneEvidence.findMany({
      include: {
        mission: { select: { missionCode: true, title: true } },
        incident: { select: { id: true, title: true } },
      },
      orderBy: { capturedAt: "desc" },
      take: 200,
    });
    return { data: evidence };
  }

  async adminLinkEvidence(dto: LinkDroneEvidenceDto, actor: JwtPayload) {
    validateLinkDroneEvidenceDto(dto);
    const evidence = await (this.prisma as any).droneEvidence.create({
      data: {
        missionId: dto.missionId,
        incidentId: dto.incidentId,
        incidentMediaId: dto.incidentMediaId,
        mediaType: dto.mediaType,
        title: dto.title,
        bucket: dto.bucket,
        objectKey: dto.objectKey,
        fileHash: dto.fileHash,
        capturedAt: new Date(),
      },
    });
    await this.audit(actor, "drone.evidence_linked", "drone_evidence", evidence.id, {
      missionId: dto.missionId,
      incidentId: dto.incidentId,
    });
    return { data: evidence };
  }

  async adminListGeofences(_actor: JwtPayload) {
    const rows = await (this.prisma as any).droneGeofence.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
    return { data: rows };
  }

  async adminCreateGeofence(dto: CreateDroneGeofenceDto, actor: JwtPayload) {
    validateCreateDroneGeofenceDto(dto);
    const row = await (this.prisma as any).droneGeofence.create({
      data: {
        name: dto.name.trim(),
        fenceType: dto.fenceType ?? "Operational",
        description: dto.description?.trim(),
        geometry: dto.geometry,
      },
    });
    await this.audit(actor, "drone.geofence_created", "drone_geofences", row.id, { name: row.name });
    return { data: row };
  }

  async adminListNoFlyZones(_actor: JwtPayload) {
    const rows = await (this.prisma as any).droneNoFlyZone.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
    return { data: rows };
  }

  async adminCreateNoFlyZone(dto: CreateDroneNoFlyZoneDto, actor: JwtPayload) {
    validateCreateDroneNoFlyZoneDto(dto);
    const row = await (this.prisma as any).droneNoFlyZone.create({
      data: {
        name: dto.name.trim(),
        reason: dto.reason?.trim(),
        geometry: dto.geometry,
      },
    });
    await this.audit(actor, "drone.no_fly_zone_created", "drone_no_fly_zones", row.id, { name: row.name });
    return { data: row };
  }

  async adminHealthOverview(_actor: JwtPayload) {
    const devices = await (this.prisma as any).droneDevice.findMany({
      where: { isActive: true },
      include: {
        healthSnapshots: { orderBy: { recordedAt: "desc" }, take: 1 },
      },
      orderBy: { deviceId: "asc" },
      take: 200,
    });
    return {
      data: devices.map((device: any) => ({
        ...this.mapDevice(device),
        latestHealth: device.healthSnapshots?.[0] ?? null,
      })),
    };
  }

  async adminLiveVideoStatus(_actor: JwtPayload) {
    const missions = await (this.prisma as any).droneMission.findMany({
      where: { liveVideoStatus: { in: ["Starting", "Live"] } },
      include: {
        drone: true,
        incident: { select: { id: true, title: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    return { data: missions.map((mission: any) => this.mapMission(mission)) };
  }

  async adminLiveGps(_actor: JwtPayload) {
    const missions = await (this.prisma as any).droneMission.findMany({
      where: { status: { in: ["Active", "Preflight", "Paused"] } },
      include: {
        drone: true,
        gpsTracks: { orderBy: { capturedAt: "desc" }, take: 1 },
        incident: { select: { id: true, title: true, latitude: true, longitude: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return {
      data: missions.map((mission: any) => ({
        ...this.mapMission(mission),
        latestTrack: mission.gpsTracks?.[0] ?? null,
      })),
    };
  }

  async adminIncidentMissions(_actor: JwtPayload) {
    const missions = await (this.prisma as any).droneMission.findMany({
      where: { incidentId: { not: null } },
      include: {
        drone: true,
        incident: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return { data: missions.map((mission: any) => this.mapMission(mission)) };
  }

  private async createMissionRecord(dto: CreateDroneMissionDto, adminSub?: string) {
    const missionCode = `DRN-${Date.now().toString(36).toUpperCase()}`;
    return (this.prisma as any).droneMission.create({
      data: {
        missionCode,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        priority: dto.priority ?? "P3",
        status: dto.scheduledAt ? "Scheduled" : "Preflight",
        droneId: dto.droneId,
        operatorId: dto.operatorId,
        commanderId: dto.commanderId,
        incidentId: dto.incidentId,
        targetLatitude: dto.targetLatitude,
        targetLongitude: dto.targetLongitude,
        targetAddress: dto.targetAddress,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        correlationId: randomUUID(),
        createdByAdminId: adminSub,
      },
      include: { drone: true, incident: { select: { id: true, title: true } } },
    });
  }

  private mapDevice(device: any) {
    return {
      id: device.id,
      deviceId: device.deviceId,
      model: device.model,
      manufacturer: device.manufacturer,
      serialNumber: device.serialNumber,
      status: device.status,
      healthStatus: device.healthStatus,
      batteryLevel: device.batteryLevel,
      signalStrength: device.signalStrength,
      firmwareVersion: device.firmwareVersion,
      flightHours: device.flightHours ? Number(device.flightHours) : 0,
      totalMissions: device.totalMissions,
      liveVideoCapable: device.liveVideoCapable,
      lastGps:
        device.lastLatitude != null && device.lastLongitude != null
          ? { lat: Number(device.lastLatitude), lng: Number(device.lastLongitude), at: device.lastGpsAt }
          : null,
      lastSeenAt: device.lastSeenAt,
      isActive: device.isActive,
    };
  }

  private mapMission(mission: any, detailed = false) {
    return {
      id: mission.id,
      missionCode: mission.missionCode,
      title: mission.title,
      description: mission.description,
      status: mission.status,
      priority: mission.priority,
      incidentId: mission.incidentId,
      incident: mission.incident ?? null,
      droneId: mission.droneId,
      drone: mission.drone ? this.mapDevice(mission.drone) : null,
      operator: mission.operator ?? null,
      commander: mission.commander ?? null,
      target:
        mission.targetLatitude != null && mission.targetLongitude != null
          ? {
              lat: Number(mission.targetLatitude),
              lng: Number(mission.targetLongitude),
              address: mission.targetAddress,
            }
          : null,
      scheduledAt: mission.scheduledAt,
      launchedAt: mission.launchedAt,
      completedAt: mission.completedAt,
      liveVideoStatus: mission.liveVideoStatus,
      liveVideoSessionId: mission.liveVideoSessionId,
      correlationId: mission.correlationId,
      createdAt: mission.createdAt,
      updatedAt: mission.updatedAt,
      ...(detailed
        ? {
            gpsTracks: mission.gpsTracks ?? [],
            evidence: mission.evidence ?? [],
            flightLogs: mission.flightLogs ?? [],
          }
        : {}),
    };
  }

  private async audit(actor: JwtPayload, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>) {
    await this.auditService.record({
      actor,
      actorType: "admin",
      action,
      entityType,
      entityId,
      metadata,
    });
  }
}
