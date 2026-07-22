import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";
import {
  createHealthRedisClient,
  isRedisExplicitlyDisabled,
  resolveBroadcastSchedulerHeartbeatKey,
  shouldRegisterNotificationWorker,
} from "../../common/queue/queue-config";
import { BroadcastQueueService } from "./broadcast-queue.service";
import { BroadcastsService } from "./broadcasts.service";

const SCHEDULER_INTERVAL_MS = 30_000;
const HEARTBEAT_TTL_SECONDS = 60;
const CLAIM_BATCH_SIZE = 25;

@Injectable()
export class BroadcastSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BroadcastSchedulerService.name);
  private readonly redis?: Redis;
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastRunAt: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly broadcastsService: BroadcastsService,
    private readonly broadcastQueueService: BroadcastQueueService,
  ) {
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
    void this.runCycle("startup");
    this.timer = setInterval(() => void this.runCycle("interval"), SCHEDULER_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.redis) void this.redis.quit();
  }

  /**
   * Claim mechanism: PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` inside an UPDATE
   * that atomically transitions eligible rows to `DispatchQueued`. This prevents two
   * worker instances from claiming the same broadcast. BullMQ job IDs
   * `broadcast:auto-dispatch:{id}` provide enqueue idempotency after the DB claim.
   */
  async runCycle(reason: string) {
    if (!this.redis || this.running) return;
    this.running = true;
    try {
      const claimedIds = await this.broadcastsService.claimDueBroadcasts(CLAIM_BATCH_SIZE);
      let queued = 0;
      for (const broadcastId of claimedIds) {
        try {
          const result = await this.broadcastQueueService.enqueueAutoDispatch(broadcastId);
          if (result.queued || result.duplicate) {
            await this.broadcastsService.recordDispatchQueued(broadcastId, result.jobId, result.duplicate);
            queued += 1;
          }
        } catch (error) {
          await this.broadcastsService.revertDispatchClaim(broadcastId, error);
        }
      }
      this.lastRunAt = new Date().toISOString();
      await this.touchHeartbeat(reason, { claimed: claimedIds.length, queued });
    } catch (error) {
      const message = error instanceof Error ? error.message : "broadcast scheduler cycle failed";
      this.logger.warn(`Scheduler cycle failed (${reason}): ${message}`);
      await this.touchHeartbeat(`${reason}-error`, { error: message });
    } finally {
      this.running = false;
    }
  }

  getLastRunAt() {
    return this.lastRunAt;
  }

  private async touchHeartbeat(reason: string, metadata: Record<string, unknown> = {}) {
    if (!this.redis) return;
    const snapshot = {
      at: new Date().toISOString(),
      reason,
      hostname: process.env.HOSTNAME ?? "unknown",
      pid: process.pid,
      ...metadata,
    };
    try {
      if (this.redis.status === "wait") await this.redis.connect();
      await this.redis.set(
        resolveBroadcastSchedulerHeartbeatKey(process.env as Record<string, unknown>),
        JSON.stringify(snapshot),
        "EX",
        HEARTBEAT_TTL_SECONDS,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "scheduler heartbeat write failed";
      this.logger.warn(message);
    }
  }
}
