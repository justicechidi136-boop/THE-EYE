import { ForbiddenException, Injectable } from "@nestjs/common";
import type { JwtPayload } from "../../common/auth/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { assertFieldSession, decimalOrNull } from "./field-session.util";

type MapMarker = {
  id: string;
  layer: string;
  latitude: number;
  longitude: number;
  title: string;
  severity?: string;
  status?: string;
  distanceMeters?: number;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class FieldMapService {
  constructor(private readonly prisma: PrismaService) {}

  async getMapContext(
    actor: JwtPayload,
    query: { latitude?: number; longitude?: number; radiusMeters?: number; layers?: string },
  ) {
    const ctx = assertFieldSession(actor);
    if (!ctx.agencyId) throw new ForbiddenException("Agency scope required for map context");

    const lat = query.latitude;
    const lng = query.longitude;
    const radius = Math.min(query.radiusMeters ?? 15000, 50000);
    const requestedLayers = new Set(
      (query.layers ?? "currentUnit,assignedIncidents,nearbyIncidents,fieldUnits,policeStations,dangerZones,missingPersonBroadcasts,stolenVehicleBroadcasts,droneMissions,backupRequests")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );

    const markers: MapMarker[] = [];
    const layers: Record<string, unknown> = {};

    const [officerStatus, patrol, checkpoint, assignments, units, dangerZones, broadcasts, backups, drones] =
      await Promise.all([
        this.prisma.officerStatus.findUnique({ where: { officerId: ctx.officerId } }),
        this.prisma.patrolSession.findFirst({ where: { officerId: ctx.officerId, status: { in: ["Active", "Paused"] } } }),
        this.prisma.checkpointSession.findFirst({ where: { officerId: ctx.officerId, status: { in: ["Active", "Paused"] } } }),
        (this.prisma as any).incidentAssignment.findMany({
          where: {
            responder: { adminUserId: ctx.officerId },
            status: { in: ["Accepted", "EnRoute", "OnScene", "Active"] },
          },
          include: { incident: { select: { id: true, title: true, priority: true, latitude: true, longitude: true, status: true } } },
          take: 20,
        }),
        this.prisma.officerStatus.findMany({
          where: { officer: { agencyId: ctx.agencyId }, officerId: { not: ctx.officerId }, status: { in: ["OnPatrol", "AtCheckpoint", "Responding", "OnShift"] } },
          include: { officer: { select: { displayName: true } } },
          take: 50,
        }),
        requestedLayers.has("dangerZones")
          ? this.prisma.dangerZone.findMany({
              where: {
                ...(ctx.state ? { state: ctx.state } : {}),
                status: {
                  in: [
                    "ActiveCritical",
                    "ActiveHigh",
                    "ActiveModerate",
                    "Contained",
                    "Monitoring",
                  ] as never[],
                },
              },
              take: 30,
              select: {
                id: true,
                status: true,
                centerLatitude: true,
                centerLongitude: true,
                severity: true,
                publicMessage: true,
                innerRadiusMeters: true,
              },
            })
          : [],
        this.prisma.broadcast.findMany({
          where: {
            status: "Published",
            ...(ctx.state ? { state: ctx.state } : {}),
            type: { in: ["MissingPerson", "StolenVehicle"] as never[] },
          },
          orderBy: { publishedAt: "desc" },
          take: 30,
          select: { id: true, type: true, title: true, priority: true, metadata: true },
        }),
        this.prisma.fieldBackupRequest.findMany({
          where: { agencyId: ctx.agencyId, status: { in: ["Requested", "Acknowledged", "Assigned", "EnRoute"] } },
          take: 20,
        }),
        (this.prisma as any).droneMission.findMany({
          where: { status: { in: ["Active", "Preflight", "Paused"] } },
          include: { drone: true, incident: { select: { id: true, title: true } } },
          take: 10,
        }),
      ]);

    if (requestedLayers.has("currentUnit") && officerStatus?.latitude != null && officerStatus.longitude != null) {
      markers.push({
        id: ctx.officerId,
        layer: "currentUnit",
        latitude: Number(officerStatus.latitude),
        longitude: Number(officerStatus.longitude),
        title: "Your unit",
        status: officerStatus.status,
      });
    }

    if (requestedLayers.has("patrolZone") && patrol?.patrolZoneLabel) {
      layers.patrolZone = { label: patrol.patrolZoneLabel, sessionId: patrol.id };
    }
    if (requestedLayers.has("checkpointPerimeter") && checkpoint) {
      layers.checkpointPerimeter = {
        name: checkpoint.checkpointName,
        sessionId: checkpoint.id,
        latitude: checkpoint.lastLatitude != null ? Number(checkpoint.lastLatitude) : lat,
        longitude: checkpoint.lastLongitude != null ? Number(checkpoint.lastLongitude) : lng,
      };
    }

    if (requestedLayers.has("assignedIncidents")) {
      for (const row of assignments) {
        const inc = row.incident;
        if (inc?.latitude == null || inc.longitude == null) continue;
        markers.push({
          id: inc.id,
          layer: "assignedIncidents",
          latitude: Number(inc.latitude),
          longitude: Number(inc.longitude),
          title: inc.title,
          severity: inc.priority,
          status: inc.status,
          metadata: { assignmentId: row.id },
        });
      }
    }

    if (requestedLayers.has("fieldUnits")) {
      for (const unit of units) {
        if (unit.latitude == null || unit.longitude == null) continue;
        markers.push({
          id: unit.officerId,
          layer: "fieldUnits",
          latitude: Number(unit.latitude),
          longitude: Number(unit.longitude),
          title: unit.officer.displayName,
          status: unit.status,
        });
      }
    }

    if (requestedLayers.has("dangerZones")) {
      for (const zone of dangerZones as Array<{
        id: string;
        status: string;
        centerLatitude: unknown;
        centerLongitude: unknown;
        severity: string;
        publicMessage: string;
        innerRadiusMeters: number;
      }>) {
        if (zone.centerLatitude == null || zone.centerLongitude == null) continue;
        markers.push({
          id: zone.id,
          layer: "dangerZones",
          latitude: Number(zone.centerLatitude),
          longitude: Number(zone.centerLongitude),
          title: zone.publicMessage,
          severity: zone.severity,
          status: zone.status,
          metadata: { radiusMeters: zone.innerRadiusMeters },
        });
      }
    }

    if (requestedLayers.has("missingPersonBroadcasts") || requestedLayers.has("stolenVehicleBroadcasts")) {
      for (const b of broadcasts) {
        const meta = (b.metadata ?? {}) as Record<string, unknown>;
        const blat = meta.lastKnownLatitude ?? meta.latitude;
        const blng = meta.lastKnownLongitude ?? meta.longitude;
        if (blat == null || blng == null) continue;
        const layer = b.type === "MissingPerson" ? "missingPersonBroadcasts" : "stolenVehicleBroadcasts";
        if (!requestedLayers.has(layer)) continue;
        markers.push({
          id: b.id,
          layer,
          latitude: Number(blat),
          longitude: Number(blng),
          title: b.title,
          severity: b.priority,
        });
      }
    }

    if (requestedLayers.has("backupRequests")) {
      for (const backup of backups) {
        if (backup.latitude == null || backup.longitude == null) continue;
        markers.push({
          id: backup.id,
          layer: "backupRequests",
          latitude: Number(backup.latitude),
          longitude: Number(backup.longitude),
          title: `${backup.requestType} backup`,
          status: backup.status,
          severity: backup.priority,
        });
      }
    }

    if (requestedLayers.has("droneMissions")) {
      for (const mission of drones as any[]) {
        const mlat = mission.lastLatitude ?? mission.drone?.lastLatitude;
        const mlng = mission.lastLongitude ?? mission.drone?.lastLongitude;
        if (mlat == null || mlng == null) continue;
        markers.push({
          id: mission.id,
          layer: "droneMissions",
          latitude: Number(mlat),
          longitude: Number(mlng),
          title: mission.incident?.title ?? "Drone mission",
          status: mission.status,
          metadata: { readOnly: true },
        });
      }
    }

    if (lat != null && lng != null) {
      for (const marker of markers) {
        marker.distanceMeters = this.haversineMeters(lat, lng, marker.latitude, marker.longitude);
      }
    }

    return {
      data: {
        center: lat != null && lng != null ? { latitude: lat, longitude: lng } : null,
        radiusMeters: radius,
        layersEnabled: [...requestedLayers],
        layers,
        markers,
        lastKnownAt: officerStatus?.lastHeartbeatAt?.toISOString?.() ?? null,
        offlineCached: officerStatus?.isOffline ?? false,
      },
    };
  }

  private haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
}
