import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type AffectedDeviceRow = {
  userId: string;
  deviceId: string | null;
  distanceMeters: number;
  source: "watch" | "mobile" | "profile";
};

@Injectable()
export class DangerZoneGeoService {
  constructor(private readonly prisma: PrismaService) {}

  async writeZoneGeography(
    zoneId: string,
    longitude: number,
    latitude: number,
    innerRadiusMeters: number,
    warningRadiusMeters: number,
    outerAwarenessRadiusMeters: number,
  ) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE danger_zones
          SET center_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
              zone_area = ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)::geometry)::geography,
              warning_area = ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $4)::geometry)::geography,
              awareness_area = ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $5)::geometry)::geography
        WHERE id = $6::uuid`,
      longitude,
      latitude,
      innerRadiusMeters,
      warningRadiusMeters,
      outerAwarenessRadiusMeters,
      zoneId,
    );
  }

  async countAffectedInZone(zoneId: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count
         FROM device_geo_states dgs
         JOIN danger_zones dz ON dz.id = $1::uuid
        WHERE dgs.gps_location IS NOT NULL
          AND ST_Intersects(dgs.gps_location, dz.awareness_area)`,
      zoneId,
    );
    return Number(rows[0]?.count ?? 0);
  }

  async findAffectedDevices(zoneId: string, limit = 500): Promise<AffectedDeviceRow[]> {
    return this.prisma.$queryRawUnsafe(
      `SELECT dgs.user_id AS "userId",
              dgs.device_id AS "deviceId",
              ST_Distance(dgs.gps_location, dz.center_location) AS "distanceMeters",
              CASE WHEN dgs.device_id IS NOT NULL THEN 'watch' ELSE 'mobile' END AS source
         FROM device_geo_states dgs
         JOIN danger_zones dz ON dz.id = $1::uuid
        WHERE dgs.gps_location IS NOT NULL
          AND ST_Intersects(dgs.gps_location, dz.awareness_area)
        ORDER BY "distanceMeters" ASC
        LIMIT $2`,
      zoneId,
      limit,
    );
  }

  async findActiveZonesNearPoint(longitude: number, latitude: number, searchRadiusMeters = 10000) {
    return this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT dz.*,
              ST_Distance(dz.center_location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
         FROM danger_zones dz
        WHERE dz.status IN ('ActiveCritical', 'ActiveHigh', 'ActiveModerate', 'Contained', 'Monitoring')
          AND (dz.expiry_time IS NULL OR dz.expiry_time > NOW())
          AND ST_DWithin(
            dz.center_location,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            GREATEST(dz.outer_awareness_radius_meters, $3)
          )
        ORDER BY distance_meters ASC
        LIMIT 20`,
      longitude,
      latitude,
      searchRadiusMeters,
    );
  }

  async upsertDeviceGeoState(input: {
    userId: string;
    deviceId?: string | null;
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    speedMps?: number;
    headingDegrees?: number;
    trackingIntervalMs?: number;
    heartbeat?: boolean;
  }) {
    const existing = await (this.prisma as any).deviceGeoState.findFirst({
      where: { userId: input.userId, deviceId: input.deviceId ?? null },
    });
    const data = {
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters,
      speedMps: input.speedMps,
      headingDegrees: input.headingDegrees,
      trackingIntervalMs: input.trackingIntervalMs ?? existing?.trackingIntervalMs ?? 300000,
      lastEvaluatedAt: new Date(),
      lastHeartbeatAt: input.heartbeat ? new Date() : existing?.lastHeartbeatAt,
    };
    let row;
    if (existing) {
      row = await (this.prisma as any).deviceGeoState.update({ where: { id: existing.id }, data });
    } else {
      row = await (this.prisma as any).deviceGeoState.create({
        data: { userId: input.userId, deviceId: input.deviceId ?? null, ...data },
      });
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE device_geo_states
          SET gps_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        WHERE id = $3::uuid`,
      input.longitude,
      input.latitude,
      row.id,
    );
    return row;
  }
}
