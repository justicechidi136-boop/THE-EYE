/**
 * Exact hostname/path validation for deployment API URLs.
 * Uses URL parsing — never substring matching on hostnames.
 */

export const STAGING_CANONICAL_API_URL = "https://staging-api.theeye.com.ng/v1";
export const PRODUCTION_CANONICAL_API_HOST = "api.theeye.com.ng";
export const STAGING_CANONICAL_API_HOST = "staging-api.theeye.com.ng";
export const STAGING_ADMIN_HOST = "staging-dashboard8jps.theeye.com.ng";
export const CI_STATIC_COMPILE_API_URL = "https://production-ci-compile.theeye.internal";

export const DEPLOY_URL_ERROR = {
  MALFORMED: "DEP-URL-001",
  PROTOCOL: "DEP-URL-002",
  HOSTNAME: "DEP-URL-003",
  PATH: "DEP-URL-004",
  PORT: "DEP-URL-005",
  CREDENTIALS: "DEP-URL-006",
};

const ALLOWED_PATHS = ["/v1", "/v1/"];
const FORBIDDEN_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

/**
 * @param {string | undefined | null} raw
 * @param {{ environment: string; allowedHostname: string; allowCiCompileUrl?: boolean }} options
 */
export function validateDeployApiUrl(raw, options) {
  const trimmed = String(raw ?? "").trim();
  const diagnostics = {
    environment: options.environment,
    protocol: "",
    hostname: "",
    port: "",
    pathname: "",
  };

  if (!trimmed) {
    return fail(DEPLOY_URL_ERROR.MALFORMED, "malformed or missing URL", diagnostics);
  }

  if (options.allowCiCompileUrl && trimmed === CI_STATIC_COMPILE_API_URL) {
    return { ok: true, ciCompileOnly: true, diagnostics };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return fail(DEPLOY_URL_ERROR.MALFORMED, "malformed or missing URL", diagnostics);
  }

  diagnostics.protocol = parsed.protocol;
  diagnostics.hostname = parsed.hostname.toLowerCase();
  diagnostics.port = parsed.port;
  diagnostics.pathname = parsed.pathname;

  if (parsed.username || parsed.password) {
    return fail(DEPLOY_URL_ERROR.CREDENTIALS, "credentials embedded in URL", diagnostics);
  }

  if (parsed.protocol !== "https:") {
    return fail(DEPLOY_URL_ERROR.PROTOCOL, "wrong protocol", diagnostics);
  }

  if (parsed.port && parsed.port !== "443") {
    return fail(DEPLOY_URL_ERROR.PORT, "unexpected port", diagnostics);
  }

  if (FORBIDDEN_HOSTS.has(diagnostics.hostname)) {
    return fail(DEPLOY_URL_ERROR.HOSTNAME, "wrong hostname", diagnostics);
  }

  if (diagnostics.hostname !== options.allowedHostname) {
    return fail(DEPLOY_URL_ERROR.HOSTNAME, "wrong hostname", diagnostics);
  }

  if (!ALLOWED_PATHS.includes(diagnostics.pathname)) {
    return fail(DEPLOY_URL_ERROR.PATH, "wrong path", diagnostics);
  }

  return { ok: true, diagnostics };
}

/** @param {string | undefined | null} url */
export function validateStagingApiUrl(url) {
  return validateDeployApiUrl(url, {
    environment: "staging",
    allowedHostname: STAGING_CANONICAL_API_HOST,
  });
}

/**
 * @param {string | undefined | null} url
 * @param {{ allowCiCompileUrl?: boolean }} [options]
 */
export function validateProductionApiUrl(url, options = {}) {
  return validateDeployApiUrl(url, {
    environment: "production",
    allowedHostname: PRODUCTION_CANONICAL_API_HOST,
    allowCiCompileUrl: options.allowCiCompileUrl ?? false,
  });
}

/**
 * @param {{ ok?: boolean; code?: string; reason?: string; diagnostics?: Record<string, string> }} result
 */
export function logDeployUrlValidationFailure(result) {
  console.error(`Deploy API URL validation failed (${result.code ?? "DEP-URL-001"}): ${result.reason ?? "unknown"}`);
  if (result.diagnostics) {
    const { environment, protocol, hostname, port, pathname } = result.diagnostics;
    console.error(
      `environment=${environment} protocol=${protocol || "(empty)"} hostname=${hostname || "(empty)"} port=${port || "(default)"} pathname=${pathname || "(empty)"}`,
    );
  }
}

/** @param {string} code @param {string} reason @param {Record<string, string>} diagnostics */
function fail(code, reason, diagnostics) {
  return { ok: false, code, reason, diagnostics };
}
