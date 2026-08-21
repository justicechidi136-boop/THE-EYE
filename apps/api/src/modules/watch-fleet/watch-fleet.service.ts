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
import {
  buildGeographyDeviceWhere,
  decodeOwnerSummaryCursor,
  encodeOwnerSummaryCursor,
} from "./watch-fleet-geography";
import { WatchFleetStatsRepository, type OwnerStatsRow } from "./watch-fleet-stats.repository";

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
  activationStatus?: string;
  deviceStatus?: string;
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

type OwnerAggregateRow = OwnerStatsRow;

@Injectable()
export class WatchFleetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: WatchFleetStatsRepository,
  ) {}

  async ownerSummaries(actor: JwtPayload, query: OwnerSummaryQuery) {
    this.assertAdmin(actor);
    const limit = resolvePageLimit(query.limit);
    const scope = adminGeographyWhere(actor);
    const cursor = decodeOwnerSummaryCursor(query.cursor);

    const rows = await this.stats.queryOwnerAggregates({
      ownerType: query.ownerType,
      scope,
      limit,
      cursor,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const enriched = await this.enrichOwnerSummaries(pageRows, actor);

    const last = enriched[enriched.length - 1];
    const lastRow = pageRows[pageRows.length - 1];
    return {
      data: enriched,
      nextCursor:
        hasMore && last && lastRow
          ? encodeOwnerSummaryCursor(Number(lastRow.total), lastRow.current_owner_type, lastRow.current_owner_id)
          : null,
      hasMore,
      limit,
    };
  }

  async ownerDetail(actor: JwtPayload, ownerType: string, ownerId: string) {
    this.assertAdmin(actor);
    const permitted = canViewWatchSensitiveFields(actor);
    const summary: Record<string, unknown> = {
      ...(await this.buildOwnerSummary(ownerType, ownerId, actor)),
    };

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
          OR: [
            { entityId: ownerId },
            { metadata: { path: ["ownerId"], equals: ownerId } },
          ],
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
    if (query.pairingStatus?.toLowerCase() === "paired") where.userId = { not: null };
    if (query.pairingStatus?.toLowerCase() === "unpaired") where.userId = null;
    if (query.activationStatus) where.activationStatus = query.activationStatus.toUpperCase();
    if (query.deviceStatus?.toLowerCase() === "active") where.isActive = true;
    if (query.deviceStatus?.toLowerCase() === "deactivated") where.isActive = false;
    if (query.deviceStatus?.toLowerCase() === "locked") where.activationStatus = "LOCKED";
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
    const geoWhere = buildGeographyDeviceWhere(scope);
    if (geoWhere) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        geoWhere,
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

    const page = buildCursorPage(devices, limit, (item) =>
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

  async devicePairingHistory(deviceIdOrUuid: string, actor: JwtPayload) {
    this.assertAdmin(actor);
    const device = await this.prisma.smartwatchDevice.findFirst({
      where: { OR: [{ id: deviceIdOrUuid }, { deviceId: deviceIdOrUuid }] },
      select: { id: true },
    });
    if (!device) throw new NotFoundException("Watch device not found");
    const records = await (this.prisma as any).watchPairingHistoryRecord.findMany({
      where: { deviceId: device.id },
      orderBy: { pairedAt: "desc" },
      take: 200,
    });
    return { data: records };
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

    const userById = new Map(users.map((u) => [u.id, u] as const));
    type WatchOrgSummary = { id: string; name: string; status: string; phone?: string; email?: string };
    const orgById = new Map<string, WatchOrgSummary>(
      (orgs as WatchOrgSummary[]).map((o) => [o.id, o]),
    );

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
          replacementPendingWatches: Number(row.replacement_pending_count),
          retiredWatches: Number(row.retired_count),
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
          replacementPendingWatches: Number(row.replacement_pending_count),
          retiredWatches: Number(row.retired_count),
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
        replacementPendingWatches: Number(row.replacement_pending_count),
        retiredWatches: Number(row.retired_count),
        lastDeviceActivity: row.last_activity,
        accountStatus: "INVENTORY",
      };
    });
  }

  private async buildOwnerSummary(ownerType: string, ownerId: string, actor: JwtPayload) {
    const scope = adminGeographyWhere(actor);
    const rows = await this.stats.queryOwnerAggregates({
      ownerType,
      ownerId,
      scope,
      limit: 1,
    });
    const stats = rows[0];
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
      activationStatus: device.activationStatus ?? "USABLE",
      activationLockedAt: device.activationLockedAt ?? null,
      isActive: device.isActive !== false,
      deactivatedAt: device.securityDeactivatedAt ?? device.remoteDisabledAt ?? null,
      deactivationReason: device.deactivationReason ?? null,
      ownershipStatus: device.ownershipStatus,
      inventoryStatus: device.inventoryStatus,
      replacementPending: device.ownershipStatus === WatchOwnershipStatus.ReplacementPending,
      onlineStatus: device.isOnline ? "Online" : "Offline",
      batteryLevel: device.batteryLevel,
      signalStrength: device.signalStrength,
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

  private assertAdmin(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin access required");
  }
}
