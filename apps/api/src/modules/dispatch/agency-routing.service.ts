import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type AgencyRecommendation = {
  agencyId: string;
  name: string;
  type: string;
  serviceCategories: string[];
  distanceMeters: number;
  distanceSource: "postgis" | "haversine";
  availableResponders: number;
  availableUnits: number;
  activeAssignments: number;
  escalationPriority: number;
  score: number;
  rank: number;
};

export type RoutingInput = {
  jurisdictionId: string;
  latitude: number;
  longitude: number;
  suggestedAgencyTypes: string[];
  limit?: number;
};

@Injectable()
export class AgencyRoutingService {
  constructor(private readonly prisma: PrismaService) {}

  async recommend(input: RoutingInput): Promise<{ data: AgencyRecommendation[]; distanceSource: "postgis" | "haversine" }> {
    const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);
    const categories = input.suggestedAgencyTypes.length ? input.suggestedAgencyTypes : ["police"];

    try {
      const rows = await this.prisma.$queryRawUnsafe(
        `SELECT a.id,
                a.name,
                a.type,
                a.service_categories,
                a.escalation_priority,
                COALESCE(
                  ST_Distance(
                    a.agency_location,
                    ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
                  ),
                  NULL
                ) AS distance_meters,
                (
                  SELECT COUNT(*)::int
                    FROM responders r
                   WHERE r.agency_id = a.id
                     AND r.is_active = true
                     AND r.availability = 'Available'
                ) AS available_responders,
                (
                  SELECT COUNT(*)::int
                    FROM response_units ru
                   WHERE ru.agency_id = a.id
                     AND ru.is_active = true
                     AND ru.status = 'Available'
                ) AS available_units,
                (
                  SELECT COUNT(*)::int
                    FROM incident_assignments ia
                   WHERE ia.agency_id = a.id
                     AND ia.status IN ('Assigned', 'Accepted', 'Arrived')
                ) AS active_assignments
           FROM agencies a
          WHERE a.jurisdiction_id = $1::uuid
            AND a.is_active = true
            AND (
              cardinality(a.service_categories) = 0
              OR a.service_categories && $4::text[]
              OR a.type = ANY($4::text[])
            )
          ORDER BY a.escalation_priority DESC, distance_meters ASC NULLS LAST, a.name ASC
          LIMIT $5`,
        input.jurisdictionId,
        input.longitude,
        input.latitude,
        categories,
        limit * 3,
      ) as Array<Record<string, unknown>>;

      const ranked = this.rankRows(rows, input.latitude, input.longitude, limit);
      const distanceSource = ranked.some((row) => row.distanceSource === "postgis") ? "postgis" : "haversine";
      return { data: ranked, distanceSource };
    } catch {
      const agencies = await this.prisma.agency.findMany({
        where: {
          jurisdictionId: input.jurisdictionId,
          isActive: true,
        } as never,
        take: limit * 3,
      });

      const rows = agencies.map((agency) => ({
        id: agency.id,
        name: agency.name,
        type: agency.type,
        service_categories: (agency as any).serviceCategories ?? [],
        escalation_priority: (agency as any).escalationPriority ?? 0,
        latitude: (agency as any).latitude,
        longitude: (agency as any).longitude,
        distance_meters: haversineMeters(
          input.latitude,
          input.longitude,
          Number((agency as any).latitude ?? input.latitude),
          Number((agency as any).longitude ?? input.longitude),
        ),
        available_responders: 0,
        available_units: 0,
        active_assignments: 0,
      }));

      return {
        data: this.rankRows(rows, input.latitude, input.longitude, limit, "haversine"),
        distanceSource: "haversine",
      };
    }
  }

  private rankRows(
    rows: Array<Record<string, unknown>>,
    latitude: number,
    longitude: number,
    limit: number,
    forcedSource?: "postgis" | "haversine",
  ): AgencyRecommendation[] {
    const scored = rows
      .map((row) => {
        const distanceMeters =
          row.distance_meters === null || row.distance_meters === undefined
            ? haversineMeters(latitude, longitude, Number(row.latitude ?? latitude), Number(row.longitude ?? longitude))
            : Number(row.distance_meters);
        const distanceSource =
          forcedSource ?? (row.distance_meters === null || row.distance_meters === undefined ? "haversine" : "postgis");
        const availableResponders = Number(row.available_responders ?? 0);
        const availableUnits = Number(row.available_units ?? 0);
        const activeAssignments = Number(row.active_assignments ?? 0);
        const escalationPriority = Number(row.escalation_priority ?? 0);
        const score =
          escalationPriority * 1000 +
          availableResponders * 50 +
          availableUnits * 30 -
          activeAssignments * 10 -
          distanceMeters / 100;

        return {
          agencyId: String(row.id),
          name: String(row.name),
          type: String(row.type),
          serviceCategories: Array.isArray(row.service_categories) ? (row.service_categories as string[]) : [],
          distanceMeters,
          distanceSource,
          availableResponders,
          availableUnits,
          activeAssignments,
          escalationPriority,
          score,
          rank: 0,
        } satisfies AgencyRecommendation;
      })
      .sort((a, b) => b.score - a.score || a.distanceMeters - b.distanceMeters)
      .slice(0, limit)
      .map((row, index) => ({ ...row, rank: index + 1 }));

    return scored;
  }
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
