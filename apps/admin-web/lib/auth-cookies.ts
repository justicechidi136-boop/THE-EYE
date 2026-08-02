import type { NextResponse } from "next/server";

export const ACCESS_TOKEN_COOKIE = "the_eye_access_token";
export const REFRESH_TOKEN_COOKIE = "the_eye_refresh_token";

const ACCESS_COOKIE_MAX_AGE = 60 * 60;
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function authCookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure,
    path: "/",
  };
}

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
) {
  const base = authCookieOptions();
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, { ...base, maxAge: ACCESS_COOKIE_MAX_AGE });
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, { ...base, maxAge: REFRESH_COOKIE_MAX_AGE });
}

export function clearAuthCookies(response: NextResponse) {
  const base = authCookieOptions();
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", { ...base, maxAge: 0 });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", { ...base, maxAge: 0 });
}

/** Edge-safe API base URL for middleware refresh (no throw on missing deploy env). */
export function resolveMiddlewareApiBaseUrl(): string {
  const apiOrigin = process.env.API_ORIGIN?.trim();
  if (apiOrigin) {
    return `${apiOrigin.replace(/\/$/, "")}/v1`;
  }
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configured?.startsWith("http://") || configured?.startsWith("https://")) {
    return configured.replace(/\/$/, "");
  }
  return "http://localhost:4000/v1";
}

export async function refreshAuthTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  const baseUrl = resolveMiddlewareApiBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (!payload.accessToken || !payload.refreshToken) return null;
    return { accessToken: payload.accessToken, refreshToken: payload.refreshToken };
  } catch {
    return null;
  }
}
