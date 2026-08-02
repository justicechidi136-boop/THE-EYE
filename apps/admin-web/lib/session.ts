import { cookies } from "next/headers";
import type { AdminSession } from "./types/admin-views";
import { ACCESS_TOKEN_COOKIE } from "./auth-cookies";
import { verifyAdminAccessToken } from "./verify-jwt";

export { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./auth-cookies";

export async function getAccessToken() {
  const store = await cookies();
  return store.get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = await getAccessToken();
  if (!token) return null;
  return verifyAdminAccessToken(token);
}
