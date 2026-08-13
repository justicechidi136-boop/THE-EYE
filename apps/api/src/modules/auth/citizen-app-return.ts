/**
 * Citizen mobile return destinations after password reset / account recovery.
 * Never points at Admin Web /login or dashboard routes.
 * Never embeds reset/recovery tokens.
 */

export type CitizenAuthReturnResult =
  | "PASSWORD_RESET_SUCCESS"
  | "ACCOUNT_RECOVERY_SUCCESS"
  | "PASSWORD_RESET_REQUIRED"
  | "ACCOUNT_RECOVERY_CONTINUE";

export const CITIZEN_APP_SCHEMES = {
  development: "theeye-dev",
  staging: "theeye-staging",
  production: "theeye",
} as const;

/** Admin product hosts — forbidden as citizen return destinations. */
export const ADMIN_PRODUCT_HOSTS = new Set([
  "staging-dashboard8jps.theeye.com.ng",
  "dashboard.theeye.com.ng",
]);

export function resolveCitizenAppScheme(
  env: Record<string, unknown> | NodeJS.ProcessEnv = process.env,
): string {
  const explicit = String(env.CITIZEN_APP_RETURN_SCHEME ?? "").trim().toLowerCase();
  if (explicit) return explicit.replace(/[^a-z0-9+-]/g, "");

  const appEnv = String(env.THE_EYE_APP_ENV ?? env.NODE_ENV ?? "development")
    .trim()
    .toLowerCase();
  if (appEnv === "production") return CITIZEN_APP_SCHEMES.production;
  if (appEnv === "staging") return CITIZEN_APP_SCHEMES.staging;
  return CITIZEN_APP_SCHEMES.development;
}

/**
 * Custom-scheme deep link that opens THE EYE citizen mobile sign-in.
 * Example: theeye-staging://auth/login?result=PASSWORD_RESET_SUCCESS
 */
export function buildCitizenAppReturnDeepLink(
  result: CitizenAuthReturnResult,
  env: Record<string, unknown> | NodeJS.ProcessEnv = process.env,
): string {
  const scheme = resolveCitizenAppScheme(env);
  const url = new URL(`${scheme}://auth/login`);
  url.searchParams.set("result", result);
  return url.toString();
}

/**
 * Optional HTTPS soft-landing on the same public recovery host.
 * Must never be an admin /login path.
 */
export function buildCitizenAppReturnHttpsPath(result: CitizenAuthReturnResult): string {
  const params = new URLSearchParams({ result });
  return `/app/sign-in?${params.toString()}`;
}

export function assertNotAdminLoginDestination(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url, "https://placeholder.invalid");
  } catch {
    throw new Error("Citizen return URL is invalid");
  }
  const path = (parsed.pathname || "/").replace(/\/$/, "") || "/";
  const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
  // Custom-scheme theeye*://auth/login is the citizen return — allow it.
  if (!isHttp) {
    if (parsed.hostname === "auth" && (path === "/login" || path === "/")) {
      return;
    }
    return;
  }
  if (path === "/login" || path.startsWith("/login/")) {
    throw new Error("Citizen return URL must not target admin /login");
  }
  if (ADMIN_PRODUCT_HOSTS.has(parsed.hostname.toLowerCase()) && path === "/login") {
    throw new Error("Citizen return URL must not target admin dashboard login");
  }
  if (path.includes("dashboard") && path.includes("login")) {
    throw new Error("Citizen return URL must not target admin dashboard login");
  }
}
