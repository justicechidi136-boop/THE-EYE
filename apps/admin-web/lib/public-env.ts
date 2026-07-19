/**
 * Approved NEXT_PUBLIC_* accessors for admin-web.
 * Values are validated once at module load; production Docker builds must receive
 * build-args — never rely on .env.production.local inside images.
 */

export type AppEnv = "local" | "development" | "staging" | "production";

const DEPLOYABLE_APP_ENVS = ["staging", "production"] as const;
export type DeployableAppEnv = (typeof DEPLOYABLE_APP_ENVS)[number];

const LOCAL_DEV_API_BASE_PATH = "/v1";

const STAGING_LEAK_MARKERS = ["the-eye-2stg", "staging-api", "NEXT_PUBLIC_APP_ENV=staging"] as const;
const PRODUCTION_PROJECT_MARKERS = ["the-eye-2pd-d0217", "NEXT_PUBLIC_APP_ENV=production"] as const;
const DEVELOPMENT_LEAK_MARKERS = ["the-eye-29cff", "NEXT_PUBLIC_APP_ENV=local", "NEXT_PUBLIC_APP_ENV=development"] as const;

const PRODUCTION_API_HOST = "api.theeye.com.ng";
const STAGING_API_HOST = "staging-api.theeye.com.ng";
const STAGING_ADMIN_HOST = "staging-dashboard8jps.theeye.com.ng";

function apiHostname(apiBaseUrl: string): string | null {
  try {
    if (!apiBaseUrl.startsWith("http://") && !apiBaseUrl.startsWith("https://")) return null;
    return new URL(apiBaseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isProductionApiHost(apiBaseUrl: string): boolean {
  return apiHostname(apiBaseUrl) === PRODUCTION_API_HOST;
}

function isStagingApiHost(apiBaseUrl: string): boolean {
  return apiHostname(apiBaseUrl) === STAGING_API_HOST;
}

function isStagingAdminHost(apiBaseUrl: string): boolean {
  return apiHostname(apiBaseUrl) === STAGING_ADMIN_HOST;
}

function isProductionNodeEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

function readRawAppEnv(): string | undefined {
  const value = process.env.NEXT_PUBLIC_APP_ENV?.trim();
  return value || undefined;
}

function readRawApiBaseUrl(): string | undefined {
  const configured =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim();
  return configured || undefined;
}

/** Bracket access so Next.js does not inline missing build-time values into the server bundle. */
function readRuntimeEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/** Docker Compose DNS uses lowercase service names (e.g. `api`, not `API`). */
function normalizeApiOrigin(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    const port = url.port ? `:${url.port}` : "";
    return `${url.protocol}//${url.hostname}${port}`.replace(/\/$/, "");
  } catch {
    return trimmed.replace(/\/$/, "");
  }
}

function assertNoMarkers(snapshot: string, markers: readonly string[], message: string): void {
  if (markers.some((marker) => snapshot.includes(marker))) {
    throw new Error(message);
  }
}

function collectPublicEnvSnapshot(): string {
  return Object.entries(process.env)
    .filter(([key]) => key.startsWith("NEXT_PUBLIC_"))
    .map(([key, value]) => `${key}=${value ?? ""}`)
    .join("\n");
}

function normalizeAppEnv(raw: string | undefined): AppEnv {
  if (!raw) {
    if (!isProductionNodeEnv()) return "local";
    throw new Error(
      "NEXT_PUBLIC_APP_ENV is required for production admin-web builds (local | development | staging | production)",
    );
  }

  if (raw === "local" || raw === "development" || raw === "staging" || raw === "production") {
    return raw;
  }

  throw new Error(
    `NEXT_PUBLIC_APP_ENV must be one of local, development, staging, production (received "${raw}")`,
  );
}

function isLocalAppEnv(appEnv: AppEnv): boolean {
  return appEnv === "local" || appEnv === "development";
}

function isDeployableAppEnv(appEnv: AppEnv): appEnv is DeployableAppEnv {
  return (DEPLOYABLE_APP_ENVS as readonly string[]).includes(appEnv);
}

function validateDeployableApiBaseUrl(appEnv: DeployableAppEnv, apiBaseUrl: string): void {
  const lower = apiBaseUrl.toLowerCase();

  if (!apiBaseUrl) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is required for staging and production admin-web builds");
  }

  if (lower.includes("localhost") || lower.includes("127.0.0.1")) {
    throw new Error(`${appEnv} admin-web builds must not use localhost API URLs`);
  }

  if (apiBaseUrl.startsWith("http://")) {
    throw new Error(`${appEnv} admin-web builds must use HTTPS API URLs (received "${apiBaseUrl}")`);
  }

  if (apiBaseUrl.startsWith("https://")) {
    if (appEnv === "staging" && isStagingAdminHost(apiBaseUrl)) {
      throw new Error(
        "Staging admin-web build must not use admin dashboard hostname as API URL — use https://staging-api.theeye.com.ng/v1",
      );
    }
    if (appEnv === "staging" && isProductionApiHost(apiBaseUrl)) {
      throw new Error("Staging admin-web build must not target production API hosts");
    }
    if (appEnv === "production" && isStagingApiHost(apiBaseUrl)) {
      throw new Error("Production admin-web build must not target staging API hosts");
    }
    if (appEnv === "staging") {
      assertNoMarkers(
        lower,
        PRODUCTION_PROJECT_MARKERS,
        "Staging admin-web build must not target production Firebase configuration",
      );
    }
    if (appEnv === "production") {
      assertNoMarkers(
        lower,
        ["the-eye-2stg"],
        "Production admin-web build must not target staging Firebase configuration",
      );
    }
    return;
  }

  if (apiBaseUrl.startsWith("/")) {
    return;
  }

  throw new Error(
    `NEXT_PUBLIC_API_BASE_URL must be an absolute HTTPS URL or a relative path (received "${apiBaseUrl}")`,
  );
}

function validatePublicEnvIsolation(appEnv: AppEnv): void {
  if (!isProductionNodeEnv() || isLocalAppEnv(appEnv)) return;

  const snapshot = collectPublicEnvSnapshot();

  if (appEnv === "production") {
    assertNoMarkers(
      snapshot,
      [...STAGING_LEAK_MARKERS, ...DEVELOPMENT_LEAK_MARKERS],
      "Production admin-web build leaked staging/development NEXT_PUBLIC_* configuration",
    );
  }

  if (appEnv === "staging") {
    assertNoMarkers(
      snapshot,
      PRODUCTION_PROJECT_MARKERS,
      "Staging admin-web build leaked production NEXT_PUBLIC_* configuration",
    );
    const configuredApi = readRawApiBaseUrl();
    if (configuredApi && isProductionApiHost(configuredApi)) {
      throw new Error("Staging admin-web build leaked production NEXT_PUBLIC_* configuration");
    }
  }

  if (isLocalAppEnv(appEnv)) {
    throw new Error("NEXT_PUBLIC_APP_ENV must not be local/development for production admin-web builds");
  }
}

function resolveLocalDevApiOrigin(): string {
  return `http://${"localhost"}:4000`;
}

function extractApiPath(configured: string | undefined): string {
  if (!configured) return LOCAL_DEV_API_BASE_PATH;
  if (configured.startsWith("http://") || configured.startsWith("https://")) {
    try {
      const pathname = new URL(configured).pathname.replace(/\/$/, "");
      return pathname || LOCAL_DEV_API_BASE_PATH;
    } catch {
      return LOCAL_DEV_API_BASE_PATH;
    }
  }
  return configured.startsWith("/") ? configured : `/${configured}`;
}

function resolveLocalPublicApiBaseUrl(configured: string | undefined): string {
  if (configured) {
    if (configured.startsWith("http://") || configured.startsWith("https://")) {
      return configured.replace(/\/$/, "");
    }
    const origin = readRuntimeEnv("API_ORIGIN") ?? resolveLocalDevApiOrigin();
    return `${origin.replace(/\/$/, "")}${configured.startsWith("/") ? configured : `/${configured}`}`;
  }

  return `${resolveLocalDevApiOrigin()}${LOCAL_DEV_API_BASE_PATH}`;
}

function resolvePublicApiBaseUrlForEnv(appEnv: AppEnv): string {
  const configured = readRawApiBaseUrl();

  if (isDeployableAppEnv(appEnv)) {
    if (!configured) {
      throw new Error("NEXT_PUBLIC_API_BASE_URL is required for staging and production admin-web builds");
    }
    validateDeployableApiBaseUrl(appEnv, configured);
    if (configured.startsWith("http://") || configured.startsWith("https://")) {
      return configured.replace(/\/$/, "");
    }
    return configured;
  }

  return resolveLocalPublicApiBaseUrl(configured);
}

function resolveAppEnvLabel(appEnv: AppEnv): string {
  switch (appEnv) {
    case "production":
      return "Production";
    case "staging":
      return "Staging";
    case "development":
      return "Development";
    default:
      return "Local";
  }
}

function resolveAppEnvBadgeTone(appEnv: AppEnv): "danger" | "warning" | "success" | "info" | "neutral" {
  switch (appEnv) {
    case "production":
      return "success";
    case "staging":
      return "warning";
    case "development":
      return "info";
    default:
      return "neutral";
  }
}

/** Validates and resolves the active application environment. */
export function resolveAppEnv(): AppEnv {
  const appEnv = normalizeAppEnv(readRawAppEnv());
  validatePublicEnvIsolation(appEnv);
  return appEnv;
}

/** Browser-safe API base URL (absolute URL or relative path such as /v1). */
export function resolvePublicApiBaseUrl(): string {
  const appEnv = resolveAppEnv();
  return resolvePublicApiBaseUrlForEnv(appEnv);
}

/** Server-side API base URL; prefers API_ORIGIN for container-to-container routing in Docker. */
export function resolveServerApiBaseUrl(): string {
  const appEnv = resolveAppEnv();
  const configured = readRawApiBaseUrl();
  const path = extractApiPath(configured);

  const apiOrigin = readRuntimeEnv("API_ORIGIN");
  if (apiOrigin) {
    return `${normalizeApiOrigin(apiOrigin)}${path.startsWith("/") ? path : `/${path}`}`;
  }

  if (configured?.startsWith("http://") || configured?.startsWith("https://")) {
    return configured.replace(/\/$/, "");
  }

  const origin = isLocalAppEnv(appEnv) ? resolveLocalDevApiOrigin() : undefined;
  if (!origin) {
    throw new Error("API_ORIGIN is required for server-side API calls in deployable Docker builds");
  }

  return `${origin.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Safe runtime diagnostics for server-side API routing (no secrets). */
export function resolveServerApiDiagnostics(): {
  baseUrl: string;
  apiOriginConfigured: boolean;
  apiOriginHost: string | null;
  publicApiPath: string;
} {
  const configured = readRawApiBaseUrl();
  const path = extractApiPath(configured);
  const apiOrigin = readRuntimeEnv("API_ORIGIN");
  let apiOriginHost: string | null = null;
  if (apiOrigin) {
    try {
      apiOriginHost = new URL(normalizeApiOrigin(apiOrigin)).hostname;
    } catch {
      apiOriginHost = null;
    }
  }

  return {
    baseUrl: resolveServerApiBaseUrl(),
    apiOriginConfigured: Boolean(apiOrigin),
    apiOriginHost,
    publicApiPath: path,
  };
}

export const publicAppEnv = resolveAppEnv();
export const publicApiBaseUrl = resolvePublicApiBaseUrl();
export const publicAppEnvLabel = resolveAppEnvLabel(publicAppEnv);
export const publicAppEnvBadgeTone = resolveAppEnvBadgeTone(publicAppEnv);
