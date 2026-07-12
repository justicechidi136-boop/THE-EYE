import { cookies } from "next/headers";
import type { AdminSession } from "./types/admin-views";
import { verifyAdminAccessToken } from "./verify-jwt";

export const ACCESS_TOKEN_COOKIE = "the_eye_access_token";
export const REFRESH_TOKEN_COOKIE = "the_eye_refresh_token";

export async function getAccessToken() {
  const store = await cookies();
  return store.get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = await getAccessToken();
  if (!token) return null;
  return verifyAdminAccessToken(token);
}
