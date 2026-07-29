import { Injectable } from "@nestjs/common";
import { DangerZoneGeoService } from "./danger-zone-geo.service";
import { DangerZoneDeliveryService } from "./danger-zone-delivery.service";
import { PrismaService } from "../prisma/prisma.service";

const COOLDOWN_MS: Record<string, number> = {
  Awareness: 15 * 60 * 1000,
  Approaching: 5 * 60 * 1000,
  Critical: 2 * 60 * 1000,
  InsideDangerZone: 60 * 1000,
  MovingAway: 10 * 60 * 1000,
  Clear: 30 * 60 * 1000,
};

const STATE_RANK: Record<string, number> = {
  Clear: 0,
  Awareness: 1,
  Approaching: 2,
  Critical: 3,
  InsideDangerZone: 4,
  MovingAway: 1,
};

export type LocationEvaluationInput = {
  userId: string;
  deviceId?: string | null;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  speedMps?: number;
  headingDegrees?: number;
};

@Injectable()
export class DangerZoneTargetingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: DangerZoneGeoService,
    private readonly delivery: DangerZoneDeliveryService,
  ) {}

  async evaluateLocation(input: LocationEvaluationInput) {
    const geoState = await this.geo.upsertDeviceGeoState({
      userId: input.userId,
      deviceId: input.deviceId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters,
      speedMps: input.speedMps,
      headingDegrees: input.headingDegrees,
    });

    const zones = await this.geo.findActiveZonesNearPoint(input.longitude, input.latitude);
    if (!zones.length) {
      if (geoState.alertState !== "Clear") {
        await (this.prisma as any).deviceGeoState.update({
          where: { id: geoState.id },
          data: { alertState: "Clear", activeDangerZoneId: null, lastDistanceMeters: null },
        });
      }
      return { alertState: "Clear", trackingIntervalMs: 300000, alerts: [] as unknown[] };
    }

    const nearest = zones[0];
    const zoneId = String(nearest.id);
    const distanceMeters = Number(nearest.distance_meters ?? 99999);
    const inner = Number(nearest.inner_radius_meters);
    const warning = Number(nearest.warning_radius_meters);
    const outer = Number(nearest.outer_awareness_radius_meters);

    const previousDistance = geoState.lastDistanceMeters != null ? Number(geoState.lastDistanceMeters) : null;
    const nextState = this.resolveAlertState(distanceMeters, inner, warning, outer, previousDistance, input.headingDegrees);

    let trackingIntervalMs = 300000;
    if (nextState === "InsideDangerZone" || nextState === "Critical") trackingIntervalMs = 5000;
    else if (nextState === "Approaching" || nextState === "Awareness") trackingIntervalMs = 30000;

    await (this.prisma as any).deviceGeoState.update({
      where: { id: geoState.id },
      data: {
        alertState: nextState,
        activeDangerZoneId: zoneId,
        lastDistanceMeters: distanceMeters,
        trackingIntervalMs,
      },
    });

    const previousState = String(geoState.alertState ?? "Clear");
    const shouldNotify = this.shouldNotify(previousState, nextState);

    const alerts = shouldNotify
      ? [await this.delivery.deliverProximityAlert({
          dangerZoneId: zoneId,
          userId: input.userId,
          deviceId: input.deviceId,
          alertState: nextState,
          distanceMeters,
          incidentId: String(nearest.incident_id),
          publicMessage: String(nearest.public_message),
          avoidanceInstruction: String(nearest.avoidance_instruction),
          severity: String(nearest.severity),
          actorAdminId: String(nearest.created_by_admin_id),
        })]
      : [];

    if (previousState !== nextState) {
      if (STATE_RANK[nextState] > STATE_RANK[previousState]) {
        await (this.prisma as any).zoneEntryEvent.create({
          data: {
            dangerZoneId: zoneId,
            userId: input.userId,
            deviceId: input.deviceId ?? null,
            alertState: nextState as never,
            distanceMeters,
          },
        });
      } else if (nextState === "Clear" || nextState === "MovingAway") {
        await (this.prisma as any).zoneExitEvent.create({
          data: {
            dangerZoneId: zoneId,
            userId: input.userId,
            deviceId: input.deviceId ?? null,
            alertState: nextState as never,
            distanceMeters,
          },
        });
      }
    }

    return { alertState: nextState, trackingIntervalMs, distanceMeters, alerts };
  }

  resolveAlertState(
    distanceMeters: number,
    innerRadius: number,
    warningRadius: number,
    outerRadius: number,
    previousDistance: number | null,
    headingDegrees?: number,
  ) {
    if (distanceMeters <= innerRadius) return "InsideDangerZone";
    if (distanceMeters <= warningRadius / 2) return "Critical";
    if (distanceMeters <= warningRadius) {
      if (previousDistance != null && previousDistance > distanceMeters + 25) return "Approaching";
      return "Approaching";
    }
    if (distanceMeters <= outerRadius) return "Awareness";
    if (previousDistance != null && previousDistance < distanceMeters - 50) return "MovingAway";
    return "Clear";
  }

  private shouldNotify(previousState: string, nextState: string) {
    if (nextState === "Clear") return false;
    return STATE_RANK[nextState] > STATE_RANK[previousState];
  }
}
