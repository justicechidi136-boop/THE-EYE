import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { RateLimitCheckResult } from "./rate-limit.policy";

type MemoryBucket = { count: number; expiresAt: number };

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly redis?: Redis;
  private readonly memory = new Map<string, MemoryBucket>();

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    if (process.env.THE_EYE_DISABLE_REDIS === "1") return;

    this.redis = new Redis({
      host: this.config.get<string>("REDIS_HOST", "localhost"),
      port: this.config.get<number>("REDIS_PORT", 6379),
      password: this.config.get<string>("REDIS_PASSWORD") || undefined,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }

  async consume(key: string, limit: number, windowSeconds: number, dimension: "ip" | "actor"): Promise<RateLimitCheckResult> {
    if (this.redis) {
      return this.consumeRedis(key, limit, windowSeconds, dimension);
    }
    return this.consumeMemory(key, limit, windowSeconds, dimension);
  }

  async onModuleDestroy() {
    if (this.redis) await this.redis.quit();
  }

  private async consumeRedis(
    key: string,
    limit: number,
    windowSeconds: number,
    dimension: "ip" | "actor",
  ): Promise<RateLimitCheckResult> {
    if (this.redis!.status === "wait") await this.redis!.connect();

    const redisKey = `the-eye:ratelimit:${key}`;
    const count = await this.redis!.incr(redisKey);
    if (count === 1) await this.redis!.expire(redisKey, windowSeconds);
    const retryAfterSeconds = Math.max(await this.redis!.ttl(redisKey), 1);

    return {
      allowed: count <= limit,
      count,
      limit,
      retryAfterSeconds,
      dimension,
    };
  }

  private consumeMemory(
    key: string,
    limit: number,
    windowSeconds: number,
    dimension: "ip" | "actor",
  ): RateLimitCheckResult {
    const now = Date.now();
    const existing = this.memory.get(key);
    const bucket =
      existing && existing.expiresAt > now
        ? { count: existing.count + 1, expiresAt: existing.expiresAt }
        : { count: 1, expiresAt: now + windowSeconds * 1000 };

    this.memory.set(key, bucket);
    const retryAfterSeconds = Math.max(Math.ceil((bucket.expiresAt - now) / 1000), 1);

    return {
      allowed: bucket.count <= limit,
      count: bucket.count,
      limit,
      retryAfterSeconds,
      dimension,
    };
  }
}
