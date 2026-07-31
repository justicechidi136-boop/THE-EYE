import {
  DEFAULT_WATCH_FEATURE_FLAGS,
  WATCH_FEATURE_FLAG_ENV_KEYS,
  validateWatchFeatureFlags,
  type WatchFeatureFlagKey,
  type WatchFeatureFlags,
  type WatchFeatureFlagValidationResult,
} from "@the-eye/shared";

function parseBooleanEnv(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function readConfigValue(config: Record<string, unknown>, key: string): unknown {
  const getter = (config as { get?: (name: string) => unknown }).get;
  if (typeof getter === "function") {
    return getter.call(config, key);
  }
  return config[key];
}

export function resolveWatchFeatureFlags(config: Record<string, unknown>): WatchFeatureFlags {
  const resolved = { ...DEFAULT_WATCH_FEATURE_FLAGS };
  for (const key of WATCH_FEATURE_FLAG_ENV_KEYS) {
    resolved[key] = parseBooleanEnv(
      readConfigValue(config, key),
      DEFAULT_WATCH_FEATURE_FLAGS[key as WatchFeatureFlagKey],
    );
  }

  const appEnv = String(
    readConfigValue(config, "THE_EYE_APP_ENV") ??
      readConfigValue(config, "NODE_ENV") ??
      "development",
  ).toLowerCase();
  if (appEnv === "production") {
    resolved.WATCH_ADMIN_TEST_ALERT = false;
  }
  if (appEnv === "staging") {
    resolved.WATCH_ADMIN_TEST_ALERT = parseBooleanEnv(
      readConfigValue(config, "WATCH_ADMIN_TEST_ALERT"),
      true,
    );
  }

  return resolved;
}

export function inspectWatchFeatureFlags(config: Record<string, unknown>): WatchFeatureFlagValidationResult {
  return validateWatchFeatureFlags(resolveWatchFeatureFlags(config));
}

export function isWatchFeatureEnabled(
  config: Record<string, unknown>,
  flag: WatchFeatureFlagKey,
): boolean {
  return resolveWatchFeatureFlags(config)[flag];
}
