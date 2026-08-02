import { NextResponse } from "next/server";
import { apiRequest } from "../../../../lib/api/client";
import { clearAuthCookies, setAuthCookies } from "../../../../lib/auth-cookies";
import { REFRESH_TOKEN_COOKIE } from "../../../../lib/session";

export async function POST(request: Request) {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    try {
      await apiRequest("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Cookie revocation still proceeds when API is unreachable.
    }
  }

  const loginUrl = new URL("/login", request.url);
  const response = NextResponse.redirect(loginUrl, 303);
  clearAuthCookies(response);
  return response;
}
