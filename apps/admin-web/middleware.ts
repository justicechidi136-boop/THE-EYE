import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  refreshAuthTokens,
  setAuthCookies,
} from "./lib/auth-cookies";
import { verifyAdminAccessToken } from "./lib/verify-jwt";

const publicPaths = [
  "/login",
  "/reset-password",
  "/account-recovery",
  "/app/sign-in",
  "/sign-in",
  "/share/broadcasts",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/refresh",
  "/api/auth/password-reset",
  "/api/auth/account-recovery",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/brand") ||
    pathname === "/favicon.png" ||
    pathname === "/apple-touch-icon.png"
  ) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (accessToken && (await verifyAdminAccessToken(accessToken))) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (refreshToken) {
    const refreshed = await refreshAuthTokens(refreshToken);
    if (refreshed) {
      const response = NextResponse.next();
      setAuthCookies(response, refreshed.accessToken, refreshed.refreshToken);
      return response;
    }
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
