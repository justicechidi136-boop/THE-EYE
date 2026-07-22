import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";
import {
  createHealthRedisClient,
  isRedisExplicitlyDisabled,
  resolveWorkerHeartbeatKey,
  shouldRegisterNotificationWorker,
} from "../../common/queue/queue-config";

const HEARTBEAT_TTL_SECONDS = 60;
const HEARTBEAT_INTERVAL_MS = 15_000;

export type WorkerHeartbeatSnapshot = {
  at: string;
  hostname: string;
  pid: number;
  processedJobs: number;
};

@Injectable()
export class WorkerHeartbeatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerHeartbeatService.name);
  private readonly redis?: Redis;
  private timer?: NodeJS.Timeout;
  private processedJobs = 0;

  constructor(private readonly config: ConfigService) {
    if (isRedisExplicitlyDisabled() || !shouldRegisterNotificationWorker()) return;
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

  onModuleInit() {
    if (!this.redis) return;
    void this.touch("startup");
    this.timer = setInterval(() => void this.touch("interval"), HEARTBEAT_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.redis) void this.redis.quit();
  }

  async recordProcessedJob() {
    this.processedJobs += 1;
    await this.touch("job");
  }

  async touch(reason: string) {
    if (!this.redis) return;
    const snapshot: WorkerHeartbeatSnapshot = {
      at: new Date().toISOString(),
      hostname: process.env.HOSTNAME ?? "unknown",
      pid: process.pid,
      processedJobs: this.processedJobs,
    };
    try {
      if (this.redis.status === "wait") await this.redis.connect();
      await this.redis.set(
        resolveWorkerHeartbeatKey(process.env as Record<string, unknown>),
        JSON.stringify({ ...snapshot, reason }),
        "EX",
        HEARTBEAT_TTL_SECONDS,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "worker heartbeat write failed";
      this.logger.warn(message);
    }
  }
}
