import { ApiError, apiRequest } from "./api/client";
import type { WatchInventoryRowView } from "./types/admin-views";

type InventoryPayload = {
  data: Record<string, unknown>[];
  nextCursor?: string | null;
  hasMore?: boolean;
};

export type SmartwatchManagementResult =
  | {
      kind: "success";
      devices: WatchInventoryRowView[];
      nextCursor: string | null;
      hasMore: boolean;
    }
  | { kind: "unauthorized"; devices: [] }
  | { kind: "error"; devices: []; status: number | null; message: string };

export function toWatchInventoryRowView(record: Record<string, unknown>): WatchInventoryRowView {
  return {
    id: String(record.id ?? ""),
    watchName: String(record.watchName ?? record.deviceId ?? "Unknown watch"),
    deviceId: String(record.deviceId ?? "Unknown device"),
    serialNumber: record.serialNumber ? String(record.serialNumber) : null,
    imei: record.imei ? String(record.imei) : null,
    eid: record.eid ? String(record.eid) : null,
    model: record.model ? String(record.model) : null,
    manufacturer: record.manufacturer ? String(record.manufacturer) : null,
    firmwareVersion: record.firmwareVersion ? String(record.firmwareVersion) : null,
    appVersion: record.appVersion ? String(record.appVersion) : null,
    currentOwner: String(record.currentOwner ?? "UNASSIGNED_INVENTORY"),
    currentAssignee: record.currentAssignee ? String(record.currentAssignee) : null,
    organization: record.organization ? String(record.organization) : null,
    department: record.department ? String(record.department) : null,
    pairingStatus: String(record.pairingStatus ?? "UNPAIRED"),
    activationStatus: String(record.activationStatus ?? "USABLE"),
    activationLockedAt: record.activationLockedAt ? String(record.activationLockedAt) : null,
    isActive: record.isActive !== false,
    deactivatedAt: record.deactivatedAt ? String(record.deactivatedAt) : null,
    deactivationReason: record.deactivationReason ? String(record.deactivationReason) : null,
    ownershipStatus: String(record.ownershipStatus ?? "UNASSIGNED_INVENTORY"),
    inventoryStatus: String(record.inventoryStatus ?? "UNKNOWN"),
    onlineStatus: String(record.onlineStatus ?? "Offline"),
    batteryLevel: record.batteryLevel != null ? Number(record.batteryLevel) : null,
    signalStrength: record.signalStrength != null ? Number(record.signalStrength) : null,
    connectivityType: String(record.connectivityType ?? "Unknown"),
    lastSeen: record.lastSeen ? String(record.lastSeen) : null,
    lastSync: record.lastSync ? String(record.lastSync) : null,
    lastKnownState: record.lastKnownState ? String(record.lastKnownState) : null,
    lastKnownLga: record.lastKnownLga ? String(record.lastKnownLga) : null,
    lastSos: record.lastSos ? String(record.lastSos) : null,
    lastEmergencyAlert: record.lastEmergencyAlert ? String(record.lastEmergencyAlert) : null,
    lastLiveVideoSession: record.lastLiveVideoSession ? String(record.lastLiveVideoSession) : null,
  };
}

export async function loadSmartwatchManagementDevices(
  token: string | null | undefined,
  query: Record<string, string | undefined> = {},
  request: typeof apiRequest = apiRequest,
): Promise<SmartwatchManagementResult> {
  if (!token) return { kind: "unauthorized", devices: [] };

  try {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    if (!params.has("limit")) params.set("limit", "100");

    const response = await request<InventoryPayload>(
      `/watch-fleet/inventory?${params.toString()}`,
      { token },
    );
    if (!response || !Array.isArray(response.data)) {
      return {
        kind: "error",
        devices: [],
        status: 502,
        message: "The smartwatch service returned an invalid response.",
      };
    }

    return {
      kind: "success",
      devices: response.data.map(toWatchInventoryRowView),
      nextCursor: response.nextCursor ?? null,
      hasMore: response.hasMore === true,
    };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return { kind: "unauthorized", devices: [] };
    }
    const status = error instanceof ApiError ? error.status : null;
    return {
      kind: "error",
      devices: [],
      status,
      message: status
        ? `Smartwatch devices could not be loaded (HTTP ${status}).`
        : "Smartwatch devices could not be loaded.",
    };
  }
}

export function smartwatchDeviceState(device: WatchInventoryRowView) {
  if (device.activationStatus.toUpperCase() === "LOCKED") return "Locked";
  if (!device.isActive || device.deactivatedAt) return "Deactivated";
  return device.onlineStatus === "Online" ? "Online" : "Offline";
}
