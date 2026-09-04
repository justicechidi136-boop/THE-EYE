/**
 * Centralized password-reset and account-recovery link construction.
 * Do not build recovery/reset URLs elsewhere.
 */

export const AUTH_URL_ERROR_CODES = {
  INVALID_RESET_BASE: "AUTH-URL-001",
  INVALID_RECOVERY_BASE: "AUTH-URL-002",
  INSECURE_URL: "AUTH-URL-003",
  WRONG_ENVIRONMENT_HOST: "AUTH-URL-004",
  MISSING_RESET_BASE: "AUTH-URL-005",
  MISSING_RECOVERY_BASE: "AUTH-URL-006",
  INVALID_ADMIN_INVITATION_BASE: "AUTH-URL-007",
  MISSING_ADMIN_INVITATION_BASE: "AUTH-URL-008",
} as const;

export type AuthUrlErrorCode = (typeof AUTH_URL_ERROR_CODES)[keyof typeof AUTH_URL_ERROR_CODES];

export class AuthRecoveryUrlError extends Error {
  constructor(
    readonly code: AuthUrlErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthRecoveryUrlError";
  }
}

export type AuthLinkKind = "password_reset" | "account_recovery" | "admin_invitation";

/** Hosts with validated citizen-facing TLS for staging recovery pages. */
const STAGING_ALLOWED_HOSTS = new Set([
  "staging-dashboard8jps.theeye.com.ng",
  "staging.theeye.com.ng",
]);

const PRODUCTION_ALLOWED_HOSTS = new Set([
  "app.theeye.com.ng",
  "theeye.com.ng",
  "www.theeye.com.ng",
  "dashboard.theeye.com.ng",
]);

const ALWAYS_BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "staging-app.theeye.com.ng",
  "staging-api.theeye.com.ng",
  "staging-livekit.theeye.com.ng",
]);

const INTERNAL_HOST_SUFFIXES = [".internal", ".local", ".docker", ".svc", ".cluster.local"];

export function resolvePasswordResetBaseUrl(env: Record<string, unknown> | NodeJS.ProcessEnv): string {
  return String(env.PASSWORD_RESET_LINK_BASE_URL ?? env.MOBILE_PASSWORD_RESET_URL ?? "").trim();
}

export function resolveAccountRecoveryBaseUrl(env: Record<string, unknown> | NodeJS.ProcessEnv): string {
  return String(
    env.ACCOUNT_RECOVERY_LINK_BASE_URL ??
      env.MOBILE_ACCOUNT_RECOVERY_URL ??
      env.AUTH_RECOVERY_DEEP_LINK_BASE ??
      "",
  ).trim();
}

export function resolveAdminInvitationBaseUrl(env: Record<string, unknown> | NodeJS.ProcessEnv): string {
  return String(env.ADMIN_INVITATION_LINK_BASE_URL ?? "").trim();
}

function appEnvironment(env: Record<string, unknown> | NodeJS.ProcessEnv = process.env): string {
  return String(env.THE_EYE_APP_ENV ?? env.NODE_ENV ?? "development").trim().toLowerCase();
}

function assertAllowedHost(hostname: string, envKey: string, env: Record<string, unknown> | NodeJS.ProcessEnv): void {
  const host = hostname.toLowerCase();

  if (ALWAYS_BLOCKED_HOSTS.has(host)) {
    throw new AuthRecoveryUrlError(
      AUTH_URL_ERROR_CODES.WRONG_ENVIRONMENT_HOST,
      `${envKey}: host "${hostname}" is not permitted for citizen recovery links`,
    );
  }
  if (INTERNAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new AuthRecoveryUrlError(
      AUTH_URL_ERROR_CODES.WRONG_ENVIRONMENT_HOST,
      `${envKey}: internal hostnames are not permitted`,
    );
  }

  const environment = appEnvironment(env);

  if (environment === "staging") {
    if (PRODUCTION_ALLOWED_HOSTS.has(host)) {
      throw new AuthRecoveryUrlError(
        AUTH_URL_ERROR_CODES.WRONG_ENVIRONMENT_HOST,
        `${envKey}: production hostname is not allowed in staging`,
      );
    }
    if (!STAGING_ALLOWED_HOSTS.has(host)) {
      throw new AuthRecoveryUrlError(
        AUTH_URL_ERROR_CODES.WRONG_ENVIRONMENT_HOST,
        `${envKey}: host must be an approved staging origin (staging-dashboard8jps.theeye.com.ng or staging.theeye.com.ng)`,
      );
    }
  }

  if (environment === "production") {
    if (host.includes("staging") || STAGING_ALLOWED_HOSTS.has(host)) {
      throw new AuthRecoveryUrlError(
        AUTH_URL_ERROR_CODES.WRONG_ENVIRONMENT_HOST,
        `${envKey}: staging hostname is not allowed in production`,
      );
    }
  }
}

function assertPath(kind: AuthLinkKind, pathname: string, envKey: string): void {
  const expected = kind === "password_reset"
    ? "/reset-password"
    : kind === "account_recovery"
      ? "/account-recovery"
      : "/activate-account";
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (normalized !== expected) {
    throw new AuthRecoveryUrlError(
      kind === "password_reset"
        ? AUTH_URL_ERROR_CODES.INVALID_RESET_BASE
        : kind === "account_recovery"
          ? AUTH_URL_ERROR_CODES.INVALID_RECOVERY_BASE
          : AUTH_URL_ERROR_CODES.INVALID_ADMIN_INVITATION_BASE,
      `${envKey}: path must be ${expected}`,
    );
  }
}

export function validateAuthLinkBaseUrl(
  baseUrl: string,
  kind: AuthLinkKind,
  options: {
    requirePresent?: boolean;
    envKey?: string;
    env?: Record<string, unknown> | NodeJS.ProcessEnv;
  } = {},
): URL {
  const envKey =
    options.envKey ??
    (kind === "password_reset"
      ? "PASSWORD_RESET_LINK_BASE_URL"
      : kind === "account_recovery"
        ? "ACCOUNT_RECOVERY_LINK_BASE_URL"
        : "ADMIN_INVITATION_LINK_BASE_URL");
  const env = options.env ?? process.env;
  const trimmed = baseUrl.trim();

  if (!trimmed) {
    throw new AuthRecoveryUrlError(
      options.requirePresent
        ? kind === "password_reset"
          ? AUTH_URL_ERROR_CODES.MISSING_RESET_BASE
          : kind === "account_recovery"
            ? AUTH_URL_ERROR_CODES.MISSING_RECOVERY_BASE
            : AUTH_URL_ERROR_CODES.MISSING_ADMIN_INVITATION_BASE
        : kind === "password_reset"
          ? AUTH_URL_ERROR_CODES.INVALID_RESET_BASE
          : kind === "account_recovery"
            ? AUTH_URL_ERROR_CODES.INVALID_RECOVERY_BASE
            : AUTH_URL_ERROR_CODES.INVALID_ADMIN_INVITATION_BASE,
      `${envKey} is empty`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AuthRecoveryUrlError(
      kind === "password_reset"
        ? AUTH_URL_ERROR_CODES.INVALID_RESET_BASE
        : kind === "account_recovery"
          ? AUTH_URL_ERROR_CODES.INVALID_RECOVERY_BASE
          : AUTH_URL_ERROR_CODES.INVALID_ADMIN_INVITATION_BASE,
      `${envKey} must be a valid URL`,
    );
  }

  if (parsed.protocol !== "https:") {
    throw new AuthRecoveryUrlError(
      AUTH_URL_ERROR_CODES.INSECURE_URL,
      `${envKey} must use HTTPS`,
    );
  }

  assertAllowedHost(parsed.hostname, envKey, env);
  assertPath(kind, parsed.pathname, envKey);

  if (parsed.search || parsed.hash) {
    throw new AuthRecoveryUrlError(
      kind === "password_reset"
        ? AUTH_URL_ERROR_CODES.INVALID_RESET_BASE
        : kind === "account_recovery"
          ? AUTH_URL_ERROR_CODES.INVALID_RECOVERY_BASE
          : AUTH_URL_ERROR_CODES.INVALID_ADMIN_INVITATION_BASE,
      `${envKey} must not include query or hash (token is appended at send time)`,
    );
  }

  return parsed;
}

/** Build the final citizen-facing link. Never log the returned URL with a live token. */
export function buildAuthActionLink(
  baseUrl: string,
  token: string,
  kind: AuthLinkKind,
  env: Record<string, unknown> | NodeJS.ProcessEnv = process.env,
): string {
  const validated = validateAuthLinkBaseUrl(baseUrl, kind, {
    requirePresent: true,
    env,
  });
  const url = new URL(validated.toString());
  url.searchParams.set("token", token);
  return url.toString();
}

export function assertStagingAuthLinkBases(config: Record<string, unknown>): void {
  const resetBase = resolvePasswordResetBaseUrl(config);
  const recoveryBase = resolveAccountRecoveryBaseUrl(config);
  const invitationBase = resolveAdminInvitationBaseUrl(config);

  if (resetBase) {
    validateAuthLinkBaseUrl(resetBase, "password_reset", {
      envKey: "PASSWORD_RESET_LINK_BASE_URL",
      env: config,
    });
  }
  if (recoveryBase) {
    validateAuthLinkBaseUrl(recoveryBase, "account_recovery", {
      envKey: "ACCOUNT_RECOVERY_LINK_BASE_URL",
      env: config,
    });
  }
  if (invitationBase) {
    validateAuthLinkBaseUrl(invitationBase, "admin_invitation", {
      envKey: "ADMIN_INVITATION_LINK_BASE_URL",
      env: config,
    });
  }
}

/** Hostname only — safe for ops/QA evidence. */
export function authLinkHostname(baseUrl: string): string | null {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return null;
  }
}
