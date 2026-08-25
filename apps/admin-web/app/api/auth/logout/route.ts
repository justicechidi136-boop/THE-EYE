import { apiRequest } from "../../../../lib/api/client";
import { createLogoutResponse } from "../../../../lib/logout-response";
import { REFRESH_TOKEN_COOKIE } from "../../../../lib/session";

export async function POST() {
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

  return createLogoutResponse();
}
