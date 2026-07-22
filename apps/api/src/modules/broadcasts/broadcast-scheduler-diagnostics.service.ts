import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Queue } from "bullmq";
import type Redis from "ioredis";
import {
  createHealthRedisClient,
  isRedisExplicitlyDisabled,
  resolveBroadcastSchedulerHeartbeatKey,
} from "../../common/queue/queue-config";
import { BROADCASTS_QUEUE_NAME } from "../../common/queue/queue-names";
import { PrismaService } from "../prisma/prisma.service";

export type BroadcastSchedulerHealth = {
  active: boolean;
  lastRunAt: string | null;
  lastRunAgeMs: number | null;
  dueCount: number;
  claimedCount: number;
  dispatchFailures: number;
  staleScheduledCount: number;
  nextScheduledAt: string | null;
  queue: {
    connected: boolean;
    available: boolean;
    waiting: number;
    active: number;
    failed: number;
  };
};

@Injectable()
export class BroadcastSchedulerDiagnosticsService {
  private readonly redis?: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() @InjectQueue(BROADCASTS_QUEUE_NAME) private readonly queue?: Queue,
  ) {
    if (isRedisExplicitlyDisabled()) return;
    this.redis = createHealthRedisClient({
      REDIS_HOST: this.config.get<string>("REDIS_HOST"),
      REDIS_PORT: this.config.get<number>("REDIS_PORT"),
      REDIS_PASSWORD: this.config.get<string>("REDIS_PASSWORD"),
      REDIS_DB: this.config.get<number>("REDIS_DB"),
      REDIS_TLS: this.config.get<string>("REDIS_TLS"),
      BULLMQ_PREFIX: this.config.get<string>("BULLMQ_PREFIX"),
      REDIS_QUEUE_PREFIX: this.config.get<string>("REDIS_QUEUE_PREFIX"),
      THE_EYE_APP_ENV: this.config.get<string>("THE_EYE_APP_ENV"),
      FCM_PROJECT_ID: this.config.get<string>("FCM_PROJECT_ID"),
      FIREBASE_PROJECT_ID: this.config.get<string>("FIREBASE_PROJECT_ID"),
      NODE_ENV: process.env.NODE_ENV,
    });
  }

  async getHealth(): Promise<BroadcastSchedulerHealth> {
    const [counts, nextScheduled, heartbeat, queueStats] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ due: bigint; claimed: bigint; failed: bigint; stale: bigint }>>(
        `SELECT
           COUNT(*) FILTER (
             WHERE scheduled_at IS NOT NULL
               AND scheduled_at <= NOW()
               AND status IN ('Scheduled', 'Published')
               AND NOT EXISTS (SELECT 1 FROM broadcast_deliveries bd WHERE bd.broadcast_id = broadcasts.id)
           ) AS due,
           COUNT(*) FILTER (WHERE status IN ('DispatchQueued', 'Dispatching')) AS claimed,
           COUNT(*) FILTER (WHERE status = 'Failed') AS failed,
           COUNT(*) FILTER (
             WHERE status = 'Scheduled'
               AND scheduled_at IS NOT NULL
               AND scheduled_at < NOW() - INTERVAL '15 minutes'
           ) AS stale
         FROM broadcasts`,
      ),
      this.prisma.broadcast.findFirst({
        where: {
          status: "Scheduled" as never,
          scheduledAt: { gt: new Date() },
        },
        orderBy: { scheduledAt: "asc" },
        select: { scheduledAt: true },
      }),
      this.readHeartbeat(),
      this.readQueueStats(),
    ]);

    const row = counts[0] ?? { due: 0n, claimed: 0n, failed: 0n, stale: 0n };

    return {
      active: heartbeat.active,
      lastRunAt: heartbeat.at,
      lastRunAgeMs: heartbeat.ageMs,
      dueCount: Number(row.due ?? 0),
      claimedCount: Number(row.claimed ?? 0),
      dispatchFailures: Number(row.failed ?? 0),
      staleScheduledCount: Number(row.stale ?? 0),
      nextScheduledAt: nextScheduled?.scheduledAt?.toISOString() ?? null,
      queue: queueStats,
    };
  }

  private async readHeartbeat(): Promise<{ active: boolean; at: string | null; ageMs: number | null }> {
    if (!this.redis) return { active: false, at: null, ageMs: null };
    try {
      if (this.redis.status === "wait") await this.redis.connect();
      const raw = await this.redis.get(resolveBroadcastSchedulerHeartbeatKey(process.env as Record<string, unknown>));
      if (!raw) return { active: false, at: null, ageMs: null };
      const parsed = JSON.parse(raw) as { at?: string };
      if (!parsed.at) return { active: false, at: null, ageMs: null };
      const ageMs = Math.max(0, Date.now() - new Date(parsed.at).getTime());
      return { active: ageMs <= 90_000, at: parsed.at, ageMs };
    } catch {
      return { active: false, at: null, ageMs: null };
    }
  }

  private async readQueueStats(): Promise<BroadcastSchedulerHealth["queue"]> {
    const base = { connected: false, available: false, waiting: 0, active: 0, failed: 0 };
    if (!this.queue || !this.redis) return base;
    try {
      if (this.redis.status === "wait") await this.redis.connect();
      await this.redis.ping();
      base.connected = true;
      const counts = await this.queue.getJobCounts("waiting", "active", "failed");
      base.available = true;
      base.waiting = counts.waiting ?? 0;
      base.active = counts.active ?? 0;
      base.failed = counts.failed ?? 0;
    } catch {
      base.available = false;
    }
    return base;
  }
}
