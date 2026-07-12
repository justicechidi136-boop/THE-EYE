import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { JwtPayload } from "../auth/jwt";
import { RATE_LIMIT_KEY } from "./rate-limit.decorator";
import { RATE_LIMIT_POLICIES, type RateLimitActorRole, type RateLimitPolicyName } from "./rate-limit.policy";
import { RateLimitService } from "./rate-limit.service";

type HttpRequest = {
  ip?: string;
  user?: JwtPayload;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  originalUrl?: string;
  url: string;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyName = this.reflector?.getAllAndOverride<RateLimitPolicyName | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!policyName) return true;

    const request = context.switchToHttp().getRequest<HttpRequest>();
    const policy = RATE_LIMIT_POLICIES[policyName];
    const role = this.resolveRole(request.user);
    const ip = this.resolveIp(request);
    const path = request.originalUrl ?? request.url;
    const requestId = String(request.headers["x-request-id"] ?? "unknown");

    const ipResult = await this.rateLimit.consume(`ip:${ip}:${policyName}`, policy.ipLimit, policy.windowSeconds, "ip");
    if (!ipResult.allowed) {
      this.logBlocked({ policyName, role, ip, path, requestId, result: ipResult, userId: request.user?.sub });
      throw this.tooManyRequests(ipResult);
    }

    const actorLimit = policy.roleLimits[role];
    if (actorLimit !== undefined) {
      const actorId = request.user?.sub ?? "anonymous";
      const actorResult = await this.rateLimit.consume(
        `actor:${role}:${actorId}:${policyName}`,
        actorLimit,
        policy.windowSeconds,
        "actor",
      );
      if (!actorResult.allowed) {
        this.logBlocked({ policyName, role, ip, path, requestId, result: actorResult, userId: request.user?.sub });
        throw this.tooManyRequests(actorResult);
      }
    }

    return true;
  }

  private resolveRole(user?: JwtPayload): RateLimitActorRole {
    if (user?.typ === "admin") return "admin";
    if (user?.typ === "user") return "user";
    return "anonymous";
  }

  private resolveIp(request: HttpRequest) {
    const forwarded = request.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
      return forwarded.split(",")[0]?.trim() || "unknown";
    }
    return request.ip ?? "unknown";
  }

  private tooManyRequests(result: { retryAfterSeconds: number; dimension: string; limit: number }) {
    return new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Rate limit exceeded for ${result.dimension}`,
        error: "Too Many Requests",
        retryAfterSeconds: result.retryAfterSeconds,
        limit: result.limit,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private logBlocked(input: {
    policyName: RateLimitPolicyName;
    role: RateLimitActorRole;
    ip: string;
    path: string;
    requestId: string;
    userId?: string;
    result: { count: number; limit: number; retryAfterSeconds: number; dimension: string };
  }) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "rate_limit.blocked",
        policy: input.policyName,
        role: input.role,
        ip: input.ip,
        userId: input.userId ?? null,
        path: input.path,
        requestId: input.requestId,
        dimension: input.result.dimension,
        count: input.result.count,
        limit: input.result.limit,
        retryAfterSeconds: input.result.retryAfterSeconds,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}
