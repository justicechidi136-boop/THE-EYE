import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ApiError } from "../api/client";
import {
  loadSmartwatchManagementDevices,
  smartwatchDeviceState,
  toWatchInventoryRowView,
} from "../smartwatch-management";
import {
  smartwatchLocationFreshness,
  toSmartwatchTrackingLocation,
} from "../smartwatch-live-tracking";
import { canManageSmartwatches } from "../smartwatch-permissions";

describe("smartwatch management dashboard", () => {
  it("renders activation QR codes locally without sending secrets to a third party", () => {
    const workflowSource = readFileSync(
      join(process.cwd(), "components", "smartwatch", "activate-standalone-workflow.tsx"),
      "utf8",
    );
    const rendererSource = readFileSync(
      join(process.cwd(), "components", "field-operations", "pairing-qr-code.tsx"),
      "utf8",
    );
    expect(workflowSource.includes("PairingQrCode")).toBe(true);
    expect(rendererSource.includes("QRCode.toDataURL(value")).toBe(true);
    expect(rendererSource.includes("fetch(")).toBe(false);
    expect(`${workflowSource}${rendererSource}`.includes("quickchart.io")).toBe(false);
  });

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

  it("treats stale online flags as offline and accepts a fresh heartbeat", () => {
    const stale = toWatchInventoryRowView({
      id: "stale",
      onlineStatus: "Online",
      lastSeen: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    });
    const fresh = toWatchInventoryRowView({
      id: "fresh",
      onlineStatus: "Online",
      lastSeen: new Date(Date.now() - 60 * 1000).toISOString(),
    });
    expect(smartwatchDeviceState(stale)).toBe("Offline");
    expect(smartwatchDeviceState(fresh)).toBe("Online");
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

  it("normalizes bounded live tracking data without inventing missing GPS", () => {
    expect(toSmartwatchTrackingLocation({ data: { event: { latitude: null, longitude: null } } })).toBe(null);
    expect(toSmartwatchTrackingLocation({
      data: {
        latest: { latitude: 6.5244, longitude: 3.3792, accuracy: 8, capturedAt: "2026-08-22T10:00:00.000Z" },
        pollIntervalMs: 100,
      },
    })).toEqual({
      latitude: 6.5244,
      longitude: 3.3792,
      accuracyMeters: 8,
      capturedAt: "2026-08-22T10:00:00.000Z",
      pollIntervalMs: 5000,
    });
  });

  it("identifies fresh, stale and unavailable smartwatch locations", () => {
    const now = new Date("2026-08-22T10:00:30.000Z").getTime();
    expect(smartwatchLocationFreshness("2026-08-22T10:00:01.000Z", now)).toBe("Live");
    expect(smartwatchLocationFreshness("2026-08-22T09:59:00.000Z", now)).toBe("Stale");
    expect(smartwatchLocationFreshness(null, now)).toBe("Unavailable");
  });

  it("polls only the selected active emergency through the authorized admin BFF", () => {
    const source = readFileSync(
      join(process.cwd(), "components", "smartwatch", "smartwatch-live-tracking.tsx"),
      "utf8",
    );
    expect(source.includes("/api/admin/smartwatch/sos-events/")).toBe(true);
    expect(source.includes("window.setInterval(refresh, POLL_INTERVAL_MS)")).toBe(true);
    expect(source.includes("window.clearInterval(timer)")).toBe(true);
    expect(source.includes("controller.abort()")).toBe(true);
  });
});
