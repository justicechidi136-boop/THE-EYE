import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, OnModuleDestroy, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Queue } from "bullmq";
import Redis from "ioredis";
import { assertFirebaseProjectConfigured } from "../../common/auth/firebase-project";
import { buildFirebaseAdminProbe } from "../../common/auth/firebase-environment";
import {
  createHealthRedisClient,
  isProductionLikeAppEnvironment,
  isRedisExplicitlyDisabled,
  resolveWorkerHeartbeatKey,
} from "../../common/queue/queue-config";
import { NOTIFICATIONS_QUEUE_NAME } from "../../common/queue/queue-names";
import { resolveFcmRuntime } from "../notifications/providers/fcm.config";
import { MetricsService } from "../../common/metrics/metrics.service";
import { PrismaService } from "../prisma/prisma.service";

export type DependencyCheck = "ok" | "error" | "skipped" | "unavailable";

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly redis?: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
    @Optional() @InjectQueue(NOTIFICATIONS_QUEUE_NAME) private readonly notificationsQueue?: Queue,
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

  async checkDatabase(): Promise<DependencyCheck> {
    if (process.env.THE_EYE_SKIP_DB_CONNECT === "1") return "skipped";
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      this.metrics.recordDbQuery("Health", "ping", (Date.now() - startedAt) / 1000, "success");
      return "ok";
    } catch {
      this.metrics.recordDbQuery("Health", "ping", (Date.now() - startedAt) / 1000, "error");
      return "error";
    }
  }

  async checkRedis(): Promise<DependencyCheck> {
    if (isRedisExplicitlyDisabled()) {
      return isProductionLikeAppEnvironment() ? "unavailable" : "skipped";
    }
    if (!this.redis) return "error";
    const startedAt = Date.now();
    try {
      if (this.redis.status === "wait") await this.redis.connect();
      const response = await this.redis.ping();
      const outcome = response === "PONG" ? "success" : "error";
      this.metrics.recordRedisOperation("ping", (Date.now() - startedAt) / 1000, outcome === "success" ? "success" : "error");
      return response === "PONG" ? "ok" : "error";
    } catch {
      this.metrics.recordRedisOperation("ping", (Date.now() - startedAt) / 1000, "error");
      return "error";
    }
  }

  async getNotificationQueueStatus() {
    if (isRedisExplicitlyDisabled()) {
      return {
        status: isProductionLikeAppEnvironment() ? "unavailable" : "skipped",
        connected: false,
        available: false,
        queueName: NOTIFICATIONS_QUEUE_NAME,
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        completed: 0,
        oldestWaitingJobAgeMs: null,
      };
    }

    const base: {
      status: "ok" | "error" | "degraded";
      connected: boolean;
      available: boolean;
      queueName: string;
      waiting: number;
      active: number;
      delayed: number;
      failed: number;
      completed: number;
      oldestWaitingJobAgeMs: number | null;
    } = {
      status: "error",
      connected: false,
      available: false,
      queueName: NOTIFICATIONS_QUEUE_NAME,
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      completed: 0,
      oldestWaitingJobAgeMs: null as number | null,
    };

    const redisStatus = await this.checkRedis();
    base.connected = redisStatus === "ok";
    if (!this.notificationsQueue || redisStatus !== "ok") return base;

    try {
      const counts = await this.notificationsQueue.getJobCounts("waiting", "active", "delayed", "failed", "completed");
      base.available = true;
      base.status = "ok";
      base.waiting = counts.waiting ?? 0;
      base.active = counts.active ?? 0;
      base.delayed = counts.delayed ?? 0;
      base.failed = counts.failed ?? 0;
      base.completed = counts.completed ?? 0;
      const waitingJobs = await this.notificationsQueue.getJobs(["waiting"], 0, 0, true);
      if (waitingJobs[0]?.timestamp) {
        base.oldestWaitingJobAgeMs = Math.max(0, Date.now() - waitingJobs[0].timestamp);
      }
    } catch {
      base.status = "degraded";
    }

    return base;
  }

  async getNotificationWorkerStatus() {
    if (isRedisExplicitlyDisabled()) {
      return {
        status: isProductionLikeAppEnvironment() ? "unavailable" : "skipped",
        active: false,
        lastHeartbeatAt: null,
        lastHeartbeatAgeMs: null,
        processedJobs: null,
      };
    }
    if (!this.redis) {
      return { status: "unavailable", active: false, lastHeartbeatAt: null, lastHeartbeatAgeMs: null, processedJobs: null };
    }

    try {
      if (this.redis.status === "wait") await this.redis.connect();
      const raw = await this.redis.get(resolveWorkerHeartbeatKey(process.env as Record<string, unknown>));
      if (!raw) {
        return { status: "degraded", active: false, lastHeartbeatAt: null, lastHeartbeatAgeMs: null, processedJobs: null };
      }
      const parsed = JSON.parse(raw) as { at?: string; processedJobs?: number };
      const ageMs = parsed.at ? Math.max(0, Date.now() - new Date(parsed.at).getTime()) : null;
      const active = ageMs != null && ageMs <= 90_000;
      return {
        status: active ? "ok" : "degraded",
        active,
        lastHeartbeatAt: parsed.at ?? null,
        lastHeartbeatAgeMs: ageMs,
        processedJobs: typeof parsed.processedJobs === "number" ? parsed.processedJobs : null,
      };
    } catch {
      return { status: "error", active: false, lastHeartbeatAt: null, lastHeartbeatAgeMs: null, processedJobs: null };
    }
  }

  getFirebaseAdminProbe() {
    const runtime = resolveFcmRuntime(this.config);
    return {
      ...buildFirebaseAdminProbe(
        {
          THE_EYE_APP_ENV: this.config.get<string>("THE_EYE_APP_ENV"),
          FCM_PROJECT_ID: this.config.get<string>("FCM_PROJECT_ID"),
          FIREBASE_PROJECT_ID: this.config.get<string>("FIREBASE_PROJECT_ID"),
          NODE_ENV: process.env.NODE_ENV,
        },
        runtime.mode === "real"
          ? { mode: "real", projectId: runtime.projectId }
          : { mode: "simulated", reason: runtime.reason },
      ),
      queueName: NOTIFICATIONS_QUEUE_NAME,
    };
  }

  /** Project ID used by POST /auth/firebase/exchange (custom JWT verify, not Firebase Admin). */
  getFirebaseAuthProbe() {
    return {
      projectId: assertFirebaseProjectConfigured(this.config),
      verifyMethod: "google-x509-jwt",
    };
  }

  async onModuleDestroy() {
    if (this.redis) await this.redis.quit();
  }
}
