import { ForbiddenException } from "@nestjs/common";
import { PermissionsGuard } from "../permissions.guard";

function contextWithUser(user: unknown) {
  return {
    getHandler: () => "handler",
    getClass: () => "class",
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}

describe("PermissionsGuard", () => {
  it("allows requests when all required permissions are present", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["incident:read", "audit:read"]) } as any;
    const guard = new PermissionsGuard(reflector);
    const allowed = guard.canActivate(contextWithUser({ permissions: ["incident:read", "audit:read"] }));
    expect(allowed).toBe(true);
  });

  it("rejects requests missing a required permission", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["incident:update"]) } as any;
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(contextWithUser({ permissions: ["incident:read"] }))).toThrow(ForbiddenException);
  });

  it("allows open routes without permission metadata", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as any;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(contextWithUser(undefined))).toBe(true);
  });
});
