import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Queue } from "bullmq";
import type Redis from "ioredis";
import {
  createHealthRedisClient,
  isRedisExplicitlyDisabled,
  resolveWorkerHeartbeatKey,
} from "../../common/queue/queue-config";
import { NOTIFICATIONS_QUEUE_NAME } from "../../common/queue/queue-names";

export type NotificationQueueDiagnostics = {
  connected: boolean;
  available: boolean;
  queueName: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  oldestWaitingJobAgeMs: number | null;
};

export type NotificationWorkerDiagnostics = {
  active: boolean;
  lastHeartbeatAt: string | null;
  lastHeartbeatAgeMs: number | null;
  processedJobs: number | null;
};

@Injectable()
export class NotificationQueueDiagnosticsService {
  private readonly redis?: Redis;

  constructor(
    private readonly config: ConfigService,
    @Optional() @InjectQueue(NOTIFICATIONS_QUEUE_NAME) private readonly queue?: Queue,
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

  async getQueueDiagnostics(): Promise<NotificationQueueDiagnostics> {
    const base = {
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

    if (!this.queue || !this.redis) return base;

    try {
      if (this.redis.status === "wait") await this.redis.connect();
      await this.redis.ping();
      base.connected = true;
    } catch {
      return base;
    }

    try {
      const counts = await this.queue.getJobCounts("waiting", "active", "delayed", "failed", "completed");
      base.available = true;
      base.waiting = counts.waiting ?? 0;
      base.active = counts.active ?? 0;
      base.delayed = counts.delayed ?? 0;
      base.failed = counts.failed ?? 0;
      base.completed = counts.completed ?? 0;

      const waitingJobs = await this.queue.getJobs(["waiting"], 0, 0, true);
      const oldest = waitingJobs[0];
      if (oldest?.timestamp) {
        base.oldestWaitingJobAgeMs = Math.max(0, Date.now() - oldest.timestamp);
      }
    } catch {
      base.available = false;
    }

    return base;
  }

  async getWorkerDiagnostics(): Promise<NotificationWorkerDiagnostics> {
    const empty: NotificationWorkerDiagnostics = {
      active: false,
      lastHeartbeatAt: null,
      lastHeartbeatAgeMs: null,
      processedJobs: null,
    };
    if (!this.redis) return empty;

    try {
      if (this.redis.status === "wait") await this.redis.connect();
      const raw = await this.redis.get(resolveWorkerHeartbeatKey(process.env as Record<string, unknown>));
      if (!raw) return empty;
      const parsed = JSON.parse(raw) as { at?: string; processedJobs?: number };
      if (!parsed.at) return empty;
      const ageMs = Math.max(0, Date.now() - new Date(parsed.at).getTime());
      return {
        active: ageMs <= 90_000,
        lastHeartbeatAt: parsed.at,
        lastHeartbeatAgeMs: ageMs,
        processedJobs: typeof parsed.processedJobs === "number" ? parsed.processedJobs : null,
      };
    } catch {
      return empty;
    }
  }
}
