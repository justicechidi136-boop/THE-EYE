import { NextResponse } from "next/server";
import { apiRequest } from "../../../../lib/api/client";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../../../../lib/session";

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

  // Form POSTs must land on the login page, not a raw JSON body.
  const loginUrl = new URL("/login", request.url);
  const response = NextResponse.redirect(loginUrl, 303);
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  return response;
}
