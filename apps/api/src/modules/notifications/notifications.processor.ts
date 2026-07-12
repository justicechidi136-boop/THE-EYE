import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { NOTIFICATIONS_QUEUE_NAME } from "../../common/queue/queue-names";
import { MetricsService } from "../../common/metrics/metrics.service";
import { NotificationDeliveryService } from "./notification-delivery.service";
import { NotificationDispatchError } from "./notification-dispatch.error";
import { NotificationDispatcherService } from "./notification-dispatcher.service";
import type { NotificationDispatchPayload } from "./notification.types";

@Processor(NOTIFICATIONS_QUEUE_NAME)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly dispatcher: NotificationDispatcherService,
    private readonly delivery: NotificationDeliveryService,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<NotificationDispatchPayload>) {
    const startedAt = process.hrtime.bigint();
    const attempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    const payload = job.data;
    const channel = String(payload.channel ?? "unknown");

    try {
      const result = await this.dispatcher.dispatch(payload);
      await this.delivery.recordSuccess(payload, result, attempt);
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      this.metrics.recordNotificationDelivery(channel, durationSeconds, "success");
      this.metrics.recordQueueJob(NOTIFICATIONS_QUEUE_NAME, "completed");
      return result;
    } catch (error) {
      const dispatchError = error instanceof NotificationDispatchError ? error : null;
      const message = error instanceof Error ? error.message : "Notification dispatch failed";
      const isFinalAttempt = attempt >= maxAttempts || dispatchError?.retryable === false;
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;

      await this.delivery.recordFailure(
        payload,
        message,
        attempt,
        maxAttempts,
        isFinalAttempt,
        dispatchError?.responsePayload,
      );

      const retryable = dispatchError?.retryable ?? true;
      if (!isFinalAttempt && retryable) {
        this.metrics.recordNotificationDelivery(channel, durationSeconds, "retry");
        this.metrics.recordQueueJob(NOTIFICATIONS_QUEUE_NAME, "retried");
        throw error;
      }

      this.metrics.recordNotificationDelivery(channel, durationSeconds, "failed");
      this.metrics.recordQueueJob(NOTIFICATIONS_QUEUE_NAME, "failed");
      this.logger.error(`Notification job ${job.id} failed permanently: ${message}`);
      return { status: "Failed", error: message, attempt };
    }
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error) {
    if (!job) return;
    this.logger.error(`Notification job ${job.id} exhausted retries: ${error.message}`);
  }
}
