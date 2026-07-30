import {
  DEFAULT_WATCH_FEATURE_FLAGS,
  WATCH_FEATURE_FLAG_ENV_KEYS,
  type WatchFeatureFlagKey,
  type WatchFeatureFlags,
} from "@the-eye/shared";

function parseBooleanEnv(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function resolveWatchFeatureFlags(config: Record<string, unknown>): WatchFeatureFlags {
  const resolved = { ...DEFAULT_WATCH_FEATURE_FLAGS };
  for (const key of WATCH_FEATURE_FLAG_ENV_KEYS) {
    resolved[key] = parseBooleanEnv(config[key], DEFAULT_WATCH_FEATURE_FLAGS[key as WatchFeatureFlagKey]);
  }

  const appEnv = String(config.THE_EYE_APP_ENV ?? config.NODE_ENV ?? "development").toLowerCase();
  if (appEnv === "production") {
    resolved.WATCH_ADMIN_TEST_ALERT = false;
  }
  if (appEnv === "staging") {
    resolved.WATCH_ADMIN_TEST_ALERT = parseBooleanEnv(
      config.WATCH_ADMIN_TEST_ALERT,
      true,
    );
  }

  return resolved;
}

export function isWatchFeatureEnabled(
  config: Record<string, unknown>,
  flag: WatchFeatureFlagKey,
): boolean {
  return resolveWatchFeatureFlags(config)[flag];
}
