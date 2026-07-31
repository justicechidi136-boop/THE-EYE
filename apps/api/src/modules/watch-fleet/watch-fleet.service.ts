import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { WatchOwnerType, WatchOwnershipStatus } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import {
  buildCursorPage,
  decodeDateIdCursor,
  encodeDateIdCursor,
  resolvePageLimit,
  type CursorPageQuery,
} from "../../common/pagination/cursor-pagination";
import { PrismaService } from "../prisma/prisma.service";
import {
  adminGeographyWhere,
  canViewWatchSensitiveFields,
  maskImei,
  maskSensitiveField,
  organizationMatchesGeography,
} from "./watch-fleet-scope";

export type OwnerSummaryQuery = CursorPageQuery & {
  search?: string;
  ownerType?: string;
  country?: string;
  state?: string;
  lga?: string;
};

export type WatchInventoryQuery = CursorPageQuery & {
  ownerType?: string;
  ownerId?: string;
  organizationId?: string;
  departmentId?: string;
  assigneeId?: string;
  ownershipStatus?: string;
  assignmentStatus?: string;
  inventoryStatus?: string;
  pairingStatus?: string;
  onlineStatus?: string;
  search?: string;
  serialNumber?: string;
  imei?: string;
  eid?: string;
  batteryMax?: string;
  firmwareVersion?: string;
  appVersion?: string;
  sort?: string;
};

type OwnerAggregateRow = {
  current_owner_type: string;
  current_owner_id: string | null;
  total: bigint;
  online_count: bigint;
  offline_count: bigint;
  low_battery_count: bigint;
  sos_active_count: bigint;
  unassigned_count: bigint;
  lost_stolen_count: bigint;
  last_activity: Date | null;
};

@Injectable()
export class WatchFleetService {
  constructor(private readonly prisma: PrismaService) {}

  async ownerSummaries(actor: JwtPayload, query: OwnerSummaryQuery) {
    this.assertAdmin(actor);
    const limit = resolvePageLimit(query.limit);
    const scope = adminGeographyWhere(actor);

    const deviceWhere: Record<string, unknown> = {};
    if (query.ownerType) deviceWhere.currentOwnerType = query.ownerType;

    const groups = await this.prisma.smartwatchDevice.groupBy({
      by: ["currentOwnerType", "currentOwnerId"],
      where: deviceWhere as never,
      _count: { id: true },
      _max: { lastSeenAt: true },
      orderBy: { _count: { id: "desc" } },
      take: limit + 1,
    });

    const scopedGroups = await this.filterOwnerGroupsByGeography(groups, scope);
    const pageGroups = scopedGroups.slice(0, limit);
    const statsByOwner = await this.loadOwnerStats(pageGroups);

    const enriched = await this.enrichOwnerSummaries(
      pageGroups.map((group) => {
        const key = `${group.currentOwnerType}:${group.currentOwnerId ?? "none"}`;
        const stats = statsByOwner.get(key) ?? {
          total: BigInt(group._count.id),
          online_count: 0n,
          offline_count: 0n,
          low_battery_count: 0n,
          sos_active_count: 0n,
          unassigned_count: 0n,
          lost_stolen_count: 0n,
          last_activity: group._max.lastSeenAt,
        };
        return {
          current_owner_type: group.currentOwnerType,
          current_owner_id: group.currentOwnerId,
          total: stats.total,
          online_count: stats.online_count,
          offline_count: stats.offline_count,
          low_battery_count: stats.low_battery_count,
          sos_active_count: stats.sos_active_count,
          unassigned_count: stats.unassigned_count,
          lost_stolen_count: stats.lost_stolen_count,
          last_activity: stats.last_activity ?? group._max.lastSeenAt,
        };
      }),
      actor,
    );

    const hasMore = scopedGroups.length > limit;
    const last = enriched[enriched.length - 1];
    return {
      data: enriched,
      nextCursor: hasMore && last ? encodeDateIdCursor(last.lastDeviceActivity ?? new Date(), last.ownerKey) : null,
      hasMore,
      limit,
    };
  }

  async ownerDetail(actor: JwtPayload, ownerType: string, ownerId: string) {
    this.assertAdmin(actor);
    const permitted = canViewWatchSensitiveFields(actor);
    const summary = await this.buildOwnerSummary(ownerType, ownerId, actor);

    const [ownershipHistory, assignmentHistory, transferHistory, auditHistory] = await Promise.all([
      ownerType !== WatchOwnerType.UnassignedInventory
        ? (this.prisma as any).watchOwnershipRecord.findMany({
            where: {
              ...(ownerType === WatchOwnerType.Person
                ? { ownerPersonId: ownerId }
                : { ownerOrganizationId: ownerId }),
            },
            orderBy: { validFrom: "desc" },
            take: 100,
          })
        : [],
      ownerType === WatchOwnerType.Organization
        ? (this.prisma as any).watchAssignmentRecord.findMany({
            where: { organizationId: ownerId },
            orderBy: { validFrom: "desc" },
            take: 100,
          })
        : [],
      (this.prisma as any).watchTransferRecord.findMany({
        where: {
          OR: [{ fromOwnerId: ownerId }, { toOwnerId: ownerId }],
        },
        orderBy: { transferredAt: "desc" },
        take: 100,
      }),
      this.prisma.auditLog.findMany({
        where: {
          action: { startsWith: "watch." },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    if (ownerType === WatchOwnerType.Organization) {
      const departments = await (this.prisma as any).watchDepartment.findMany({
        where: { organizationId: ownerId },
        include: {
          _count: { select: { devices: true } },
        },
      });
      summary.departments = departments;
    }

    if (ownerType === WatchOwnerType.Person) {
      const user = await this.prisma.user.findUnique({
        where: { id: ownerId },
        include: { profile: true },
      });
      if (user) {
        summary.phone = maskSensitiveField(user.phone, permitted);
        summary.email = maskSensitiveField(user.email, permitted);
        summary.accountStatus = user.status;
      }
    }

    return {
      data: {
        ...summary,
        ownershipHistory: permitted ? ownershipHistory : ownershipHistory.map((r: { ipAddress?: string }) => ({ ...r, ipAddress: null })),
        assignmentHistory,
        transferHistory,
        auditHistory,
      },
    };
  }

  async watchInventory(actor: JwtPayload, query: WatchInventoryQuery) {
    this.assertAdmin(actor);
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const permitted = canViewWatchSensitiveFields(actor);
    const scope = adminGeographyWhere(actor);

    const where: Record<string, unknown> = {};
    if (query.ownerType) where.currentOwnerType = query.ownerType;
    if (query.ownerId) where.currentOwnerId = query.ownerId;
    if (query.organizationId) where.currentOrganizationId = query.organizationId;
    if (query.departmentId) where.currentDepartmentId = query.departmentId;
    if (query.assigneeId) where.currentAssigneeId = query.assigneeId;
    if (query.ownershipStatus) where.ownershipStatus = query.ownershipStatus;
    if (query.assignmentStatus) where.assignmentStatus = query.assignmentStatus;
    if (query.inventoryStatus) where.inventoryStatus = query.inventoryStatus;
    if (query.onlineStatus === "online") where.isOnline = true;
    if (query.onlineStatus === "offline") where.isOnline = false;
    if (query.serialNumber) where.serialNumber = query.serialNumber;
    if (query.imei) where.imei = query.imei;
    if (query.eid) where.eid = query.eid;
    if (query.firmwareVersion) where.firmwareVersion = query.firmwareVersion;
    if (query.appVersion) where.appVersion = query.appVersion;
    if (query.batteryMax) where.batteryLevel = { lte: Number(query.batteryMax) };
    if (query.search) {
      where.OR = [
        { deviceId: { contains: query.search, mode: "insensitive" } },
        { displayName: { contains: query.search, mode: "insensitive" } },
        { serialNumber: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (cursor) {
      const createdAt = new Date(cursor.createdAt);
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [{ lastSeenAt: { lt: createdAt } }, { lastSeenAt: createdAt, id: { lt: cursor.id } }],
        },
      ];
    }

    const devices = await this.prisma.smartwatchDevice.findMany({
      where: where as never,
      include: {
        user: { include: { profile: true } },
        currentOrganization: true,
        currentDepartment: true,
        currentInventoryLocation: true,
      },
      orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const filtered = devices.filter((device) => this.deviceInScope(device, scope));
    const page = buildCursorPage(filtered, limit, (item) =>
      encodeDateIdCursor(item.lastSeenAt ?? item.createdAt, item.id),
    );

    return {
      ...page,
      data: page.data.map((device) => this.mapDeviceRow(device, permitted)),
    };
  }

  async unassignedInventory(actor: JwtPayload, query: CursorPageQuery) {
    return this.watchInventory(actor, {
      ...query,
      ownerType: WatchOwnerType.UnassignedInventory,
      ownershipStatus: WatchOwnershipStatus.UnassignedInventory,
    });
  }

  async organizationFleet(actor: JwtPayload, organizationId: string, query: WatchInventoryQuery) {
    const org = await (this.prisma as any).watchOrganization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException("Organization not found");
    const scope = adminGeographyWhere(actor);
    if (!organizationMatchesGeography(org, scope)) throw new ForbiddenException("Organization outside your scope");
    return this.watchInventory(actor, { ...query, organizationId });
  }

  private async enrichOwnerSummaries(rows: OwnerAggregateRow[], actor: JwtPayload) {
    const permitted = canViewWatchSensitiveFields(actor);
    const personIds = rows.filter((r) => r.current_owner_type === WatchOwnerType.Person && r.current_owner_id).map((r) => r.current_owner_id!);
    const orgIds = rows.filter((r) => r.current_owner_type === WatchOwnerType.Organization && r.current_owner_id).map((r) => r.current_owner_id!);

    const [users, orgs] = await Promise.all([
      personIds.length
        ? this.prisma.user.findMany({ where: { id: { in: personIds } }, include: { profile: true } })
        : [],
      orgIds.length ? (this.prisma as any).watchOrganization.findMany({ where: { id: { in: orgIds } } }) : [],
    ]);

    const userById = new Map(users.map((u) => [u.id, u]));
    const orgById = new Map(orgs.map((o: { id: string }) => [o.id, o]));

    return rows.map((row) => {
      const ownerKey = `${row.current_owner_type}:${row.current_owner_id ?? "none"}`;
      if (row.current_owner_type === WatchOwnerType.Person && row.current_owner_id) {
        const user = userById.get(row.current_owner_id);
        const profile = user?.profile;
        return {
          ownerKey,
          ownerType: "Person",
          ownerId: row.current_owner_id,
          ownerName: profile ? `${profile.firstName} ${profile.lastName}` : row.current_owner_id,
          phone: maskSensitiveField(user?.phone ?? null, permitted),
          email: maskSensitiveField(user?.email ?? null, permitted),
          organization: null,
          department: null,
          currentAssignee: profile ? `${profile.firstName} ${profile.lastName}` : null,
          totalWatches: Number(row.total),
          onlineWatches: Number(row.online_count),
          offlineWatches: Number(row.offline_count),
          lowBatteryWatches: Number(row.low_battery_count),
          sosActiveWatches: Number(row.sos_active_count),
          unassignedWatches: Number(row.unassigned_count),
          lostStolenWatches: Number(row.lost_stolen_count),
          lastDeviceActivity: row.last_activity,
          accountStatus: user?.status ?? null,
        };
      }
      if (row.current_owner_type === WatchOwnerType.Organization && row.current_owner_id) {
        const org = orgById.get(row.current_owner_id) as { name: string; status: string; phone?: string; email?: string } | undefined;
        return {
          ownerKey,
          ownerType: "Organization",
          ownerId: row.current_owner_id,
          ownerName: org?.name ?? row.current_owner_id,
          phone: maskSensitiveField(org?.phone ?? null, permitted),
          email: maskSensitiveField(org?.email ?? null, permitted),
          organization: org?.name ?? null,
          department: null,
          currentAssignee: null,
          totalWatches: Number(row.total),
          onlineWatches: Number(row.online_count),
          offlineWatches: Number(row.offline_count),
          lowBatteryWatches: Number(row.low_battery_count),
          sosActiveWatches: Number(row.sos_active_count),
          unassignedWatches: Number(row.unassigned_count),
          lostStolenWatches: Number(row.lost_stolen_count),
          lastDeviceActivity: row.last_activity,
          accountStatus: org?.status ?? null,
        };
      }
      return {
        ownerKey,
        ownerType: "Unassigned Inventory",
        ownerId: row.current_owner_id,
        ownerName: "Unassigned Inventory",
        phone: null,
        email: null,
        organization: null,
        department: null,
        currentAssignee: null,
        totalWatches: Number(row.total),
        onlineWatches: Number(row.online_count),
        offlineWatches: Number(row.offline_count),
        lowBatteryWatches: Number(row.low_battery_count),
        sosActiveWatches: Number(row.sos_active_count),
        unassignedWatches: Number(row.unassigned_count),
        lostStolenWatches: Number(row.lost_stolen_count),
        lastDeviceActivity: row.last_activity,
        accountStatus: "INVENTORY",
      };
    });
  }

  private async buildOwnerSummary(ownerType: string, ownerId: string, actor: JwtPayload) {
    const groups = [{ currentOwnerType: ownerType, currentOwnerId: ownerId, _count: { id: 0 }, _max: { lastSeenAt: null as Date | null } }];
    const statsByOwner = await this.loadOwnerStats(groups);
    const key = `${ownerType}:${ownerId}`;
    const stats = statsByOwner.get(key);
    if (!stats || stats.total === 0n) throw new NotFoundException("Owner not found or has no watches");

    const enriched = await this.enrichOwnerSummaries([stats], actor);
    return enriched[0];
  }

  private mapDeviceRow(device: Record<string, any>, permitted: boolean) {
    const profile = device.user?.profile;
    const assigneeName = profile ? `${profile.firstName} ${profile.lastName}` : null;
    return {
      id: device.id,
      watchName: device.displayName ?? device.deviceId,
      deviceId: device.deviceId,
      serialNumber: device.serialNumber,
      imei: maskImei(device.imei, permitted),
      eid: maskImei(device.eid, permitted),
      model: device.model,
      manufacturer: device.manufacturer,
      osVersion: device.metadata?.osVersion ?? null,
      firmwareVersion: device.firmwareVersion,
      appVersion: device.appVersion,
      currentOwner: device.currentOwnerType,
      currentAssignee: assigneeName,
      organization: device.currentOrganization?.name ?? null,
      department: device.currentDepartment?.name ?? null,
      pairingStatus: device.userId ? "PAIRED" : "UNPAIRED",
      ownershipStatus: device.ownershipStatus,
      inventoryStatus: device.inventoryStatus,
      onlineStatus: device.isOnline ? "Online" : "Offline",
      batteryLevel: device.batteryLevel,
      connectivityType: device.connectivityMode,
      lastSeen: device.lastSeenAt,
      lastSync: device.lastSyncAt,
      lastKnownState: device.lastKnownState,
      lastKnownLga: device.lastKnownLga,
      lastSos: device.lastSosAt,
      lastEmergencyAlert: device.lastEmergencyAlertAt,
      lastLiveVideoSession: device.lastLiveVideoSessionAt,
    };
  }

  private async filterOwnerGroupsByGeography(
    groups: { currentOwnerType: string; currentOwnerId: string | null; _count: { id: number }; _max: { lastSeenAt: Date | null } }[],
    scope: ReturnType<typeof adminGeographyWhere>,
  ) {
    if (!scope || (!scope.country && !scope.state && !scope.lga)) return groups;

    const personIds = groups
      .filter((g) => g.currentOwnerType === WatchOwnerType.Person && g.currentOwnerId)
      .map((g) => g.currentOwnerId!);
    const orgIds = groups
      .filter((g) => g.currentOwnerType === WatchOwnerType.Organization && g.currentOwnerId)
      .map((g) => g.currentOwnerId!);

    const [profiles, orgs] = await Promise.all([
      personIds.length
        ? this.prisma.profile.findMany({ where: { userId: { in: personIds } }, select: { userId: true, country: true, state: true, lga: true } })
        : [],
      orgIds.length
        ? (this.prisma as any).watchOrganization.findMany({
            where: { id: { in: orgIds } },
            select: { id: true, country: true, state: true, lga: true },
          })
        : [],
    ]);

    const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
    const orgById = new Map(orgs.map((o: { id: string }) => [o.id, o]));

    return groups.filter((group) => {
      if (group.currentOwnerType === WatchOwnerType.UnassignedInventory) return true;
      const geo =
        group.currentOwnerType === WatchOwnerType.Person
          ? profileByUser.get(group.currentOwnerId!)
          : orgById.get(group.currentOwnerId!);
      if (!geo) return true;
      return organizationMatchesGeography(geo as { country: string; state: string; lga: string }, scope);
    });
  }

  private async loadOwnerStats(
    groups: { currentOwnerType: string; currentOwnerId: string | null }[],
  ) {
    const stats = new Map<string, OwnerAggregateRow>();
    if (!groups.length) return stats;

    const orClauses = groups
      .filter((g) => g.currentOwnerId)
      .map((g) => ({
        currentOwnerType: g.currentOwnerType,
        currentOwnerId: g.currentOwnerId!,
      }));

    if (!orClauses.length) return stats;

    const devices = await this.prisma.smartwatchDevice.findMany({
      where: { OR: orClauses },
      select: {
        currentOwnerType: true,
        currentOwnerId: true,
        isOnline: true,
        batteryLevel: true,
        lastSosAt: true,
        assignmentStatus: true,
        ownershipStatus: true,
        lastSeenAt: true,
      },
    });

    const sosCutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const device of devices) {
      const key = `${device.currentOwnerType}:${device.currentOwnerId ?? "none"}`;
      const row =
        stats.get(key) ??
        ({
          current_owner_type: device.currentOwnerType,
          current_owner_id: device.currentOwnerId,
          total: 0n,
          online_count: 0n,
          offline_count: 0n,
          low_battery_count: 0n,
          sos_active_count: 0n,
          unassigned_count: 0n,
          lost_stolen_count: 0n,
          last_activity: null,
        } as OwnerAggregateRow);

      row.total += 1n;
      if (device.isOnline) row.online_count += 1n;
      else row.offline_count += 1n;
      if (device.batteryLevel != null && device.batteryLevel <= 20) row.low_battery_count += 1n;
      if (device.lastSosAt && device.lastSosAt.getTime() > sosCutoff) row.sos_active_count += 1n;
      if (device.assignmentStatus === "UNASSIGNED") row.unassigned_count += 1n;
      if (device.ownershipStatus === WatchOwnershipStatus.LostOrStolen) row.lost_stolen_count += 1n;
      if (!row.last_activity || (device.lastSeenAt && device.lastSeenAt > row.last_activity)) {
        row.last_activity = device.lastSeenAt;
      }
      stats.set(key, row);
    }

    return stats;
  }

  private deviceInScope(device: Record<string, any>, scope: ReturnType<typeof adminGeographyWhere>) {
    if (!scope) return true;
    const profile = device.user?.profile;
    const org = device.currentOrganization;
    const geo = profile
      ? { country: profile.country, state: profile.state, lga: profile.lga }
      : org
        ? { country: org.country, state: org.state, lga: org.lga }
        : null;
    if (!geo) return true;
    return organizationMatchesGeography(geo, scope);
  }

  private assertAdmin(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin access required");
  }
}
