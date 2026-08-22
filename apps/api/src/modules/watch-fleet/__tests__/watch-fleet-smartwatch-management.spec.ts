import { ForbiddenException } from "@nestjs/common";
import { AdminRoleName } from "@the-eye/shared";
import { WatchFleetService } from "../watch-fleet.service";

function buildService(rows: Record<string, unknown>[] = []) {
  const prisma = {
    smartwatchDevice: {
      findMany: jest.fn().mockResolvedValue(rows),
    },
  };
  return {
    prisma,
    service: new WatchFleetService(prisma as never, {} as never),
  };
}

const superAdmin = {
  sub: "admin-1",
  typ: "admin",
  role: AdminRoleName.SuperAdmin,
  permissions: ["user:manage"],
} as never;

describe("watch fleet smartwatch management", () => {
  it("rejects a non-admin service caller", async () => {
    const { service } = buildService();
    await expect(
      service.watchInventory({ sub: "user-1", typ: "user", permissions: ["user:manage"] } as never, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns an empty paginated device list to a permitted admin", async () => {
    const { service } = buildService();
    const result = await service.watchInventory(superAdmin, { limit: "20" });
    expect(result.data).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.limit).toBe(20);
  });

  it("returns locked, deactivated and partial metadata without sensitive activation material", async () => {
    const { service } = buildService([
      {
        id: "watch-1",
        deviceId: "EYE-WATCH-1",
        displayName: null,
        userId: null,
        user: null,
        currentOrganization: null,
        currentDepartment: null,
        activationStatus: "LOCKED",
        activationLockedAt: new Date("2026-08-20T10:00:00.000Z"),
        isActive: false,
        securityDeactivatedAt: new Date("2026-08-20T11:00:00.000Z"),
        deactivationReason: "Admin recovery",
        deviceSecretHash: "must-not-be-returned",
        pairingCodeHash: "must-not-be-returned",
        batteryLevel: null,
        signalStrength: null,
        isOnline: false,
        metadata: null,
        ownershipStatus: "UNASSIGNED_INVENTORY",
        inventoryStatus: "IN_STOCK",
        connectivityMode: "PairedPhone",
        createdAt: new Date("2026-08-19T10:00:00.000Z"),
      },
    ]);

    const result = await service.watchInventory(superAdmin, {});
    const device = result.data[0] as Record<string, unknown>;
    expect(device.activationStatus).toBe("LOCKED");
    expect(device.isActive).toBe(false);
    expect(device.deactivationReason).toBe("Admin recovery");
    expect(Object.prototype.hasOwnProperty.call(device, "deviceSecretHash")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(device, "pairingCodeHash")).toBe(false);
  });

  it("does not report a stale heartbeat as online", async () => {
    const { service } = buildService([
      {
        id: "watch-stale",
        deviceId: "EYE-WATCH-STALE",
        userId: null,
        user: null,
        currentOrganization: null,
        currentDepartment: null,
        isActive: true,
        isOnline: true,
        lastSeenAt: new Date(Date.now() - 11 * 60 * 1000),
        metadata: null,
        ownershipStatus: "UNASSIGNED_INVENTORY",
        inventoryStatus: "IN_STOCK",
        connectivityMode: "StandaloneCellular",
        createdAt: new Date(),
      },
    ]);

    const result = await service.watchInventory(superAdmin, {});
    expect(result.data[0].onlineStatus).toBe("Offline");
  });

  it("applies pairing, lock and geography filters in the Prisma query", async () => {
    const { service, prisma } = buildService();
    await service.watchInventory(
      {
        sub: "admin-2",
        typ: "admin",
        role: AdminRoleName.StateAdmin,
        permissions: ["user:manage"],
        country: "Nigeria",
        state: "Lagos",
      } as never,
      { pairingStatus: "paired", deviceStatus: "locked" },
    );

    expect(prisma.smartwatchDevice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: { not: null },
          activationStatus: "LOCKED",
        }),
      }),
    );
    const call = prisma.smartwatchDevice.findMany.mock.calls[0][0] as { where: { AND?: unknown[] } };
    expect(Array.isArray(call.where.AND)).toBe(true);
  });
});
