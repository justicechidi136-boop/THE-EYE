import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { WatchAssignmentStatus, WatchOwnerType, WatchOwnershipStatus } from "@the-eye/shared";
import type { GeographyScope } from "../../common/auth/admin-geography-scope";
import { PrismaService } from "../prisma/prisma.service";
import type { OwnerSummaryCursor } from "./watch-fleet-geography";

export type OwnerStatsRow = {
  current_owner_type: string;
  current_owner_id: string | null;
  total: bigint;
  online_count: bigint;
  offline_count: bigint;
  low_battery_count: bigint;
  sos_active_count: bigint;
  unassigned_count: bigint;
  lost_stolen_count: bigint;
  replacement_pending_count: bigint;
  retired_count: bigint;
  last_activity: Date | null;
};

type OwnerAggregateQuery = {
  ownerType?: string;
  ownerId?: string;
  scope: GeographyScope | null;
  limit: number;
  cursor?: OwnerSummaryCursor | null;
};

@Injectable()
export class WatchFleetStatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async queryOwnerAggregates(query: OwnerAggregateQuery): Promise<OwnerStatsRow[]> {
    const sosCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const geoClause = this.buildGeographySql(query.scope);
    const ownerTypeClause = query.ownerType
      ? Prisma.sql`AND d.current_owner_type = ${query.ownerType}`
      : Prisma.empty;
    const ownerIdClause = query.ownerId
      ? Prisma.sql`AND d.current_owner_id = ${query.ownerId}::uuid`
      : Prisma.empty;
    const cursorClause = query.cursor
      ? Prisma.sql`
          AND (
            total < ${query.cursor.total}
            OR (
              total = ${query.cursor.total}
              AND (
                current_owner_type > ${query.cursor.ownerType}
                OR (
                  current_owner_type = ${query.cursor.ownerType}
                  AND COALESCE(current_owner_id::text, 'none') > ${query.cursor.ownerId}
                )
              )
            )
          )
        `
      : Prisma.empty;

    return this.prisma.$queryRaw<OwnerStatsRow[]>`
      WITH scoped_devices AS (
        SELECT
          d.id,
          d.current_owner_type,
          d.current_owner_id,
          d.is_online,
          d.battery_level,
          d.last_sos_at,
          d.assignment_status,
          d.ownership_status,
          d.last_seen_at
        FROM smartwatch_devices d
        LEFT JOIN profiles p
          ON d.current_owner_type = ${WatchOwnerType.Person}
          AND p.user_id = d.current_owner_id
        LEFT JOIN watch_organizations o
          ON d.current_owner_type = ${WatchOwnerType.Organization}
          AND o.id = d.current_owner_id
        WHERE 1 = 1
          ${ownerTypeClause}
          ${ownerIdClause}
          ${geoClause}
      ),
      agg AS (
        SELECT
          sd.current_owner_type,
          sd.current_owner_id,
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE sd.is_online = true)::bigint AS online_count,
          COUNT(*) FILTER (WHERE sd.is_online = false)::bigint AS offline_count,
          COUNT(*) FILTER (WHERE sd.battery_level IS NOT NULL AND sd.battery_level <= 20)::bigint AS low_battery_count,
          COUNT(*) FILTER (WHERE sd.last_sos_at IS NOT NULL AND sd.last_sos_at > ${sosCutoff})::bigint AS sos_active_count,
          COUNT(*) FILTER (WHERE sd.assignment_status = ${WatchAssignmentStatus.Unassigned})::bigint AS unassigned_count,
          COUNT(*) FILTER (WHERE sd.ownership_status = ${WatchOwnershipStatus.LostOrStolen})::bigint AS lost_stolen_count,
          COUNT(*) FILTER (WHERE sd.ownership_status = ${WatchOwnershipStatus.ReplacementPending})::bigint AS replacement_pending_count,
          COUNT(*) FILTER (WHERE sd.ownership_status = ${WatchOwnershipStatus.Retired})::bigint AS retired_count,
          MAX(sd.last_seen_at) AS last_activity
        FROM scoped_devices sd
        GROUP BY sd.current_owner_type, sd.current_owner_id
      )
      SELECT *
      FROM agg
      WHERE 1 = 1
        ${cursorClause}
      ORDER BY total DESC, current_owner_type ASC, COALESCE(current_owner_id::text, 'none') ASC
      LIMIT ${query.limit + 1}
    `;
  }

  private buildGeographySql(scope: GeographyScope | null): Prisma.Sql {
    if (!scope || (!scope.country && !scope.state && !scope.lga)) {
      return Prisma.empty;
    }

    const country = scope.country ?? null;
    const state = scope.state ?? null;
    const lga = scope.lga ?? null;

    return Prisma.sql`
      AND (
        d.current_owner_type = ${WatchOwnerType.UnassignedInventory}
        OR (
          d.current_owner_type = ${WatchOwnerType.Person}
          AND (${country}::text IS NULL OR p.country = ${country})
          AND (${state}::text IS NULL OR p.state = ${state})
          AND (${lga}::text IS NULL OR p.lga = ${lga})
        )
        OR (
          d.current_owner_type = ${WatchOwnerType.Organization}
          AND (${country}::text IS NULL OR o.country = ${country})
          AND (${state}::text IS NULL OR o.state = ${state})
          AND (${lga}::text IS NULL OR o.lga = ${lga})
        )
      )
    `;
  }
}
