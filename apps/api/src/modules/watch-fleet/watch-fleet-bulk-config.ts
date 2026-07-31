import {
  isProductionLikeAppEnvironment,
  isRedisExplicitlyDisabled,
  shouldRegisterBullMq,
} from "../../common/queue/queue-config";

export type WatchFleetBulkMode = "queue" | "inline" | "required";

export const WATCH_FLEET_INLINE_BULK_MAX_DEVICES = 25;
export const WATCH_FLEET_INLINE_EXPORT_MAX_ROWS = 500;

export function resolveWatchFleetBulkMode(config: Record<string, unknown> = process.env as Record<string, unknown>): WatchFleetBulkMode {
  const raw = String(config.WATCH_FLEET_BULK_MODE ?? "queue").trim().toLowerCase();
  if (raw === "inline" || raw === "required" || raw === "queue") return raw;
  return "queue";
}

export function canRunWatchFleetBulkInline(
  deviceCount: number,
  config: Record<string, unknown> = process.env as Record<string, unknown>,
): boolean {
  if (resolveWatchFleetBulkMode(config) !== "inline") return false;
  if (isProductionLikeAppEnvironment(config)) return false;
  return deviceCount <= WATCH_FLEET_INLINE_BULK_MAX_DEVICES;
}

export function canRunWatchFleetExportInline(
  config: Record<string, unknown> = process.env as Record<string, unknown>,
): boolean {
  if (resolveWatchFleetBulkMode(config) !== "inline") return false;
  return !isProductionLikeAppEnvironment(config);
}

export function assertWatchFleetBulkConfiguration(config: Record<string, unknown> = process.env as Record<string, unknown>) {
  const mode = resolveWatchFleetBulkMode(config);
  if (mode === "inline" && isProductionLikeAppEnvironment(config)) {
    throw new Error("WATCH_FLEET_BULK_MODE=inline is not allowed in staging or production");
  }
  if (mode === "required" && isProductionLikeAppEnvironment(config) && isRedisExplicitlyDisabled(config)) {
    throw new Error("WATCH_FLEET_BULK_MODE=required but THE_EYE_DISABLE_REDIS=1");
  }
  if (isProductionLikeAppEnvironment(config) && isRedisExplicitlyDisabled(config)) {
    throw new Error("Watch fleet bulk operations require Redis in staging and production");
  }
}

export function watchFleetQueueAvailable(config: Record<string, unknown> = process.env as Record<string, unknown>): boolean {
  return shouldRegisterBullMq(config);
}
