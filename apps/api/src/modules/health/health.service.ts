import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { assertFirebaseProjectConfigured } from "../../common/auth/firebase-project";
import { buildFirebaseAdminProbe } from "../../common/auth/firebase-environment";
import { NOTIFICATIONS_QUEUE_NAME } from "../../common/queue/queue-names";
import { resolveFcmRuntime } from "../notifications/providers/fcm.config";
import { MetricsService } from "../../common/metrics/metrics.service";
import { PrismaService } from "../prisma/prisma.service";

export type DependencyCheck = "ok" | "error" | "skipped";

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly redis?: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    if (process.env.THE_EYE_DISABLE_REDIS === "1") return;

    this.redis = new Redis({
      host: this.config.get<string>("REDIS_HOST", "localhost"),
      port: this.config.get<number>("REDIS_PORT", 6379),
      password: this.config.get<string>("REDIS_PASSWORD") || undefined,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      lazyConnect: true,
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
    if (process.env.THE_EYE_DISABLE_REDIS === "1" || !this.redis) return "skipped";
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
