import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { WATCH_DANGER_ALERTS_QUEUE_NAME } from "../../common/queue/queue-names";
import { WATCH_DANGER_ALERT_JOB_NAME } from "../../common/queue/queue-jobs";
import { MetricsService } from "../../common/metrics/metrics.service";
import type { WatchDangerAlertJobPayload } from "./watch-danger-alert.types";
import { WatchDangerAlertDeliveryService } from "./watch-danger-alert-delivery.service";

@Processor(WATCH_DANGER_ALERTS_QUEUE_NAME)
export class WatchDangerAlertProcessor extends WorkerHost {
  private readonly logger = new Logger(WatchDangerAlertProcessor.name);

  constructor(
    private readonly delivery: WatchDangerAlertDeliveryService,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<WatchDangerAlertJobPayload>) {
    if (job.name !== WATCH_DANGER_ALERT_JOB_NAME) {
      this.logger.warn(`Ignoring unexpected job ${job.name}`);
      return null;
    }
    const startedAt = process.hrtime.bigint();
    try {
      const result = await this.delivery.dispatchNow(job.data);
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      this.metrics.recordQueueJob(WATCH_DANGER_ALERTS_QUEUE_NAME, "completed");
      this.metrics.recordNotificationDelivery("watch-danger-alert", durationSeconds, "success");
      return result;
    } catch (error) {
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      this.metrics.recordQueueJob(WATCH_DANGER_ALERTS_QUEUE_NAME, "failed");
      this.metrics.recordNotificationDelivery("watch-danger-alert", durationSeconds, "error");
      throw error;
    }
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(`Watch danger alert job failed (${job?.id ?? "unknown"}): ${error.message}`);
  }
}
