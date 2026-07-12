import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import type { Queue } from "bullmq";
import { NOTIFICATIONS_QUEUE_NAME } from "../queue/queue-names";
import { HealthService } from "../../modules/health/health.service";
import { MetricsService } from "./metrics.service";

const POLL_INTERVAL_MS = 15_000;

@Injectable()
export class QueueMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueMetricsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly metrics: MetricsService,
    private readonly health: HealthService,
    @Optional() @InjectQueue(NOTIFICATIONS_QUEUE_NAME) private readonly notificationsQueue?: Queue,
  ) {}

  onModuleInit() {
    if (process.env.THE_EYE_DISABLE_METRICS_POLLING === "1") return;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), POLL_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async refresh() {
    await this.refreshDependencies();
    await this.refreshQueueDepth();
  }

  private async refreshDependencies() {
    const [database, redis] = await Promise.all([
      this.health.checkDatabase(),
      this.health.checkRedis(),
    ]);
    this.metrics.setDependencyUp("postgres", database === "ok");
    this.metrics.setDependencyUp("redis", redis === "ok");
  }

  private async refreshQueueDepth() {
    if (!this.notificationsQueue) {
      for (const state of ["waiting", "active", "delayed", "failed", "completed"]) {
        this.metrics.setQueueDepth(NOTIFICATIONS_QUEUE_NAME, state, 0);
      }
      return;
    }

    try {
      const counts = await this.notificationsQueue.getJobCounts(
        "waiting",
        "active",
        "delayed",
        "failed",
        "completed",
      );
      for (const [state, count] of Object.entries(counts)) {
        this.metrics.setQueueDepth(NOTIFICATIONS_QUEUE_NAME, state, count);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "queue metrics refresh failed";
      this.logger.warn(`Unable to refresh BullMQ queue metrics: ${message}`);
    }
  }
}
