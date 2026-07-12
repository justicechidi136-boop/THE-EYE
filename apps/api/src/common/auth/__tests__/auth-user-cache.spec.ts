import { getCachedAuthUser, setCachedAuthUser, clearAuthUserCache } from "../auth-user-cache";
import type { JwtPayload } from "../jwt";

describe("auth user cache", () => {
  it("returns cached payload within TTL", () => {
    clearAuthUserCache();
    const token: JwtPayload = { sub: "user-1", typ: "user", role: "Citizen", permissions: [] };
    const resolved: JwtPayload = { ...token, email: "citizen@example.com" };
    setCachedAuthUser(token, resolved);
    expect(getCachedAuthUser(token)).toEqual(resolved);
  });

  it("misses when cache cleared", () => {
    clearAuthUserCache();
    const token: JwtPayload = { sub: "admin-1", typ: "admin", role: "Super Admin", permissions: [] };
    setCachedAuthUser(token, token);
    clearAuthUserCache();
    expect(getCachedAuthUser(token)).toBe(undefined);
  });
});
