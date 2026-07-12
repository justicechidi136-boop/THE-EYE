import { HttpException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RateLimitGuard } from "../rate-limit.guard";
import { RateLimitService } from "../rate-limit.service";

describe("RateLimitGuard", () => {
  it("allows requests under the configured limit", async () => {
    const reflector = {
      getAllAndOverride: () => "auth",
    } as unknown as Reflector;
    const rateLimit = {
      consume: jest
        .fn()
        .mockResolvedValueOnce({ allowed: true, count: 1, limit: 10, retryAfterSeconds: 60, dimension: "ip" })
        .mockResolvedValueOnce({ allowed: true, count: 1, limit: 10, retryAfterSeconds: 60, dimension: "actor" }),
    } as unknown as RateLimitService;
    const guard = new RateLimitGuard(reflector, rateLimit);

    const allowed = await guard.canActivate({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          ip: "127.0.0.1",
          headers: {},
          method: "POST",
          url: "/v1/auth/login",
        }),
      }),
    } as never);

    expect(allowed).toBe(true);
    expect(rateLimit.consume).toHaveBeenCalledTimes(2);
  });

  it("blocks and logs when the IP limit is exceeded", async () => {
    const reflector = {
      getAllAndOverride: () => "sos",
    } as unknown as Reflector;
    const rateLimit = {
      consume: jest.fn().mockResolvedValue({
        allowed: false,
        count: 7,
        limit: 6,
        retryAfterSeconds: 42,
        dimension: "ip",
      }),
    } as unknown as RateLimitService;
    const guard = new RateLimitGuard(reflector, rateLimit);

    let caught: HttpException | undefined;
    try {
      await guard.canActivate({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            ip: "203.0.113.10",
            headers: { "x-request-id": "req-1" },
            method: "POST",
            originalUrl: "/v1/smartwatch/sos",
            url: "/v1/smartwatch/sos",
          }),
        }),
      } as never);
    } catch (error) {
      caught = error as HttpException;
    }

    expect(caught?.getStatus()).toBe(429);
    expect(rateLimit.consume).toHaveBeenCalledWith("ip:203.0.113.10:sos", 6, 60, "ip");
  });

  it("applies higher admin actor limits when a user is authenticated", async () => {
    const reflector = {
      getAllAndOverride: () => "broadcastCreate",
    } as unknown as Reflector;
    const rateLimit = {
      consume: jest
        .fn()
        .mockResolvedValueOnce({ allowed: true, count: 1, limit: 12, retryAfterSeconds: 300, dimension: "ip" })
        .mockResolvedValueOnce({ allowed: true, count: 1, limit: 40, retryAfterSeconds: 300, dimension: "actor" }),
    } as unknown as RateLimitService;
    const guard = new RateLimitGuard(reflector, rateLimit);

    await guard.canActivate({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          ip: "10.0.0.5",
          user: { typ: "admin", sub: "admin-1", role: "Super Admin" },
          headers: {},
          method: "POST",
          url: "/v1/broadcasts",
        }),
      }),
    } as never);

    expect(rateLimit.consume).toHaveBeenCalledWith("actor:admin:admin-1:broadcastCreate", 40, 300, "actor");
  });
});
