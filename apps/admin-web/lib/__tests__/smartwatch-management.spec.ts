import { ApiError } from "../api/client";
import {
  loadSmartwatchManagementDevices,
  smartwatchDeviceState,
  toWatchInventoryRowView,
} from "../smartwatch-management";
import { canManageSmartwatches } from "../smartwatch-permissions";

describe("smartwatch management dashboard", () => {
  it("loads a permitted admin's smartwatch devices from the fleet endpoint", async () => {
    let requestedPath = "";
    const result = await loadSmartwatchManagementDevices(
      "admin-token",
      { pairingStatus: "paired" },
      (async (path: string) => {
        requestedPath = path;
        return { data: [{ id: "watch-1", deviceId: "EYE-WATCH-1" }], hasMore: false };
      }) as never,
    );

    expect(result.kind).toBe("success");
    expect(result.devices.length).toBe(1);
    expect(requestedPath.includes("/watch-fleet/inventory?")).toBe(true);
    expect(requestedPath.includes("pairingStatus=paired")).toBe(true);
  });

  it("supports an empty device list", async () => {
    const result = await loadSmartwatchManagementDevices(
      "admin-token",
      {},
      (async () => ({ data: [], nextCursor: null, hasMore: false })) as never,
    );
    expect(result.kind).toBe("success");
    expect(result.devices).toEqual([]);
  });

  it("returns an explicit API error state", async () => {
    const result = await loadSmartwatchManagementDevices(
      "admin-token",
      {},
      (async () => {
        throw new ApiError("internal detail", 500);
      }) as never,
    );
    expect(result.kind).toBe("error");
    expect(result.kind === "error" ? result.status : null).toBe(500);
    expect(result.kind === "error" ? result.message.includes("internal detail") : true).toBe(false);
  });

  it("distinguishes unauthorized and permitted admins", async () => {
    const unauthorized = await loadSmartwatchManagementDevices(null);
    expect(unauthorized.kind).toBe("unauthorized");
    expect(canManageSmartwatches({ permissions: ["incident:read"] } as never)).toBe(false);
    expect(canManageSmartwatches({ permissions: ["user:manage"] } as never)).toBe(true);
  });

  it("renders locked and deactivated device states", () => {
    const locked = toWatchInventoryRowView({ id: "locked", activationStatus: "LOCKED", isActive: true });
    const deactivated = toWatchInventoryRowView({ id: "off", activationStatus: "USABLE", isActive: false });
    expect(smartwatchDeviceState(locked)).toBe("Locked");
    expect(smartwatchDeviceState(deactivated)).toBe("Deactivated");
  });

  it("normalizes malformed or missing optional metadata without throwing", () => {
    const device = toWatchInventoryRowView({
      id: "partial",
      deviceId: "EYE-PARTIAL",
      model: null,
      manufacturer: null,
      batteryLevel: null,
      signalStrength: undefined,
      lastSeen: null,
      deactivationReason: null,
    });
    expect(device.model).toBe(null);
    expect(device.batteryLevel).toBe(null);
    expect(device.signalStrength).toBe(null);
    expect(device.lastSeen).toBe(null);
    expect(smartwatchDeviceState(device)).toBe("Offline");
  });

  it("rejects malformed API response shapes", async () => {
    const result = await loadSmartwatchManagementDevices(
      "admin-token",
      {},
      (async () => ({ data: null })) as never,
    );
    expect(result.kind).toBe("error");
    expect(result.kind === "error" ? result.status : null).toBe(502);
  });
});
