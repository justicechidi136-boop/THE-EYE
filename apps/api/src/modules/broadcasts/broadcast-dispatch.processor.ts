import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { MetricsService } from "../../common/metrics/metrics.service";
import { BROADCASTS_QUEUE_NAME } from "../../common/queue/queue-names";
import {
  BROADCAST_AUTO_DISPATCH_JOB_NAME,
  BROADCAST_COUNTRY_DELIVERY_JOB_NAME,
  BROADCAST_EXPIRY_REVIEW_JOB_NAME,
  BROADCAST_RESOLUTION_DELIVERY_JOB_NAME,
} from "../../common/queue/queue-jobs";
import type {
  BroadcastAutoDispatchJobPayload,
  BroadcastCountryDeliveryJobPayload,
  BroadcastExpiryReviewJobPayload,
  BroadcastResolutionDeliveryJobPayload,
} from "../../common/queue/queue-jobs";
import { WorkerHeartbeatService } from "../notifications/worker-heartbeat.service";
import { BroadcastExpirySchedulerService } from "./broadcast-expiry.scheduler.service";
import { BroadcastLifecycleService } from "./broadcast-lifecycle.service";
import { BroadcastQueueService } from "./broadcast-queue.service";
import { BroadcastsService } from "./broadcasts.service";

@Processor(BROADCASTS_QUEUE_NAME)
export class BroadcastDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(BroadcastDispatchProcessor.name);

  constructor(
    private readonly broadcastsService: BroadcastsService,
    private readonly broadcastQueue: BroadcastQueueService,
    private readonly lifecycle: BroadcastLifecycleService,
    private readonly expiryScheduler: BroadcastExpirySchedulerService,
    private readonly metrics: MetricsService,
    private readonly heartbeat: WorkerHeartbeatService,
  ) {
    super();
  }

  async process(
    job: Job<
      | BroadcastAutoDispatchJobPayload
      | BroadcastCountryDeliveryJobPayload
      | BroadcastResolutionDeliveryJobPayload
      | BroadcastExpiryReviewJobPayload
    >,
  ) {
    if (job.name === BROADCAST_RESOLUTION_DELIVERY_JOB_NAME) {
      const payload = job.data as BroadcastResolutionDeliveryJobPayload;
      const result = await this.lifecycle.executeResolutionDeliveryBatch(
        payload.broadcastId,
        payload.eventType as never,
        payload.batchNumber,
        payload.batchSize,
      );
      if (!result.completed && (result.delivered ?? 0) > 0) {
        await this.broadcastQueue.enqueueResolutionDelivery(
          payload.broadcastId,
          payload.eventType,
          payload.batchNumber + 1,
        );
      }
      await this.heartbeat.recordProcessedJob();
      this.metrics.recordQueueJob(BROADCASTS_QUEUE_NAME, "completed");
      return result;
    }

    if (job.name === BROADCAST_EXPIRY_REVIEW_JOB_NAME) {
      const payload = job.data as BroadcastExpiryReviewJobPayload;
      const result = await this.expiryScheduler.processExpiryReview(payload.broadcastId);
      await this.heartbeat.recordProcessedJob();
      this.metrics.recordQueueJob(BROADCASTS_QUEUE_NAME, "completed");
      return result;
    }

    if (job.name === BROADCAST_COUNTRY_DELIVERY_JOB_NAME) {
      await this.heartbeat.touch("broadcast-country-delivery-start");
      const payload = job.data as BroadcastCountryDeliveryJobPayload;
      const result = await this.broadcastsService.executeCountryDeliveryBatch(payload);
      if (!result.completed && (result.delivered ?? 0) > 0) {
        await this.broadcastQueue.enqueueCountryDelivery(
          payload.broadcastId,
          payload.countryCode,
          payload.batchNumber + 1,
        );
      }
      await this.heartbeat.recordProcessedJob();
      this.metrics.recordQueueJob(BROADCASTS_QUEUE_NAME, "completed");
      return result;
    }

    if (job.name !== BROADCAST_AUTO_DISPATCH_JOB_NAME) {
      this.logger.warn(`Ignoring unknown broadcast job ${job.name}`);
      return { skipped: true };
    }

    await this.heartbeat.touch("broadcast-dispatch-start");
    const startedAt = Date.now();
    try {
      const result = await this.broadcastsService.executeAutoDispatch(job.data.broadcastId);
      await this.heartbeat.recordProcessedJob();
      this.metrics.recordQueueJob(BROADCASTS_QUEUE_NAME, "completed");
      this.metrics.recordBroadcastDispatch((Date.now() - startedAt) / 1000, "success");
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Broadcast auto-dispatch failed";
      this.metrics.recordQueueJob(BROADCASTS_QUEUE_NAME, "failed");
      this.metrics.recordBroadcastDispatch((Date.now() - startedAt) / 1000, "error");
      this.logger.error(`Broadcast auto-dispatch job ${job.id} failed: ${message}`);
      throw error;
    }
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error) {
    if (!job) return;
    this.logger.error(`Broadcast job ${job.id} failed permanently: ${error.message}`);
  }
}
