/**
 * Client-safe citizen mobile return helpers (AUTH-007).
 * Must never resolve to Admin Dashboard /login.
 */

export type CitizenAuthReturnResult =
  | "PASSWORD_RESET_SUCCESS"
  | "ACCOUNT_RECOVERY_SUCCESS"
  | "PASSWORD_RESET_REQUIRED"
  | "ACCOUNT_RECOVERY_CONTINUE";

const ADMIN_LOGIN_PATHS = new Set(["/login", "/login/"]);

export function resolveCitizenAppScheme(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_CITIZEN_APP_RETURN_SCHEME ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+-]/g, "");
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host.includes("staging")) return "theeye-staging";
  }
  const appEnv = (process.env.NEXT_PUBLIC_THE_EYE_APP_ENV ?? process.env.NODE_ENV ?? "")
    .trim()
    .toLowerCase();
  if (appEnv === "staging") return "theeye-staging";
  if (appEnv === "production") return "theeye";
  return "theeye-staging";
}

export function buildCitizenAppReturnDeepLink(result: CitizenAuthReturnResult): string {
  const scheme = resolveCitizenAppScheme();
  const url = new URL(`${scheme}://auth/login`);
  url.searchParams.set("result", result);
  assertNotAdminLoginDestination(url.toString());
  return url.toString();
}

export function buildCitizenAppReturnHttpsPath(result: CitizenAuthReturnResult): string {
  const params = new URLSearchParams({ result });
  return `/app/sign-in?${params.toString()}`;
}

export function assertNotAdminLoginDestination(url: string): void {
  const parsed = new URL(url, "https://placeholder.invalid");
  const path = parsed.pathname.replace(/\/$/, "") || "/";
  const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
  // Custom-scheme theeye*://auth/login is the citizen return — allow it.
  if (!isHttp) {
    if (parsed.hostname === "auth" && (path === "/login" || path === "/")) {
      return;
    }
    return;
  }
  if (ADMIN_LOGIN_PATHS.has(parsed.pathname) || path === "/login" || path.startsWith("/login/")) {
    throw new Error("Citizen return URL must not target admin /login");
  }
}

export function citizenReturnCopy(result: CitizenAuthReturnResult): {
  title: string;
  body: string;
} {
  switch (result) {
    case "PASSWORD_RESET_SUCCESS":
      return {
        title: "PASSWORD UPDATED",
        body: "Your password has been changed successfully. You can now sign in to THE EYE using your new password.",
      };
    case "ACCOUNT_RECOVERY_SUCCESS":
      return {
        title: "ACCOUNT RECOVERED",
        body: "Your account recovery has been completed. Return to THE EYE to continue.",
      };
    case "ACCOUNT_RECOVERY_CONTINUE":
      return {
        title: "Return to THE EYE",
        body: "Return to THE EYE app to continue, or request a new recovery email from the app.",
      };
    case "PASSWORD_RESET_REQUIRED":
    default:
      return {
        title: "Return to THE EYE",
        body: "Return to THE EYE app and sign in with your new password.",
      };
  }
}
