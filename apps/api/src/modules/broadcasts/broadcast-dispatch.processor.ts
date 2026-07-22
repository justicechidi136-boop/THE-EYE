import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { BROADCAST_AUTO_DISPATCH_JOB_NAME } from "../../common/queue/queue-jobs";
import { BROADCASTS_QUEUE_NAME } from "../../common/queue/queue-names";
import { MetricsService } from "../../common/metrics/metrics.service";
import type { BroadcastAutoDispatchJobPayload } from "../../common/queue/queue-jobs";
import { WorkerHeartbeatService } from "../notifications/worker-heartbeat.service";
import { BroadcastsService } from "./broadcasts.service";

@Processor(BROADCASTS_QUEUE_NAME)
export class BroadcastDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(BroadcastDispatchProcessor.name);

  constructor(
    private readonly broadcastsService: BroadcastsService,
    private readonly metrics: MetricsService,
    private readonly heartbeat: WorkerHeartbeatService,
  ) {
    super();
  }

  async process(job: Job<BroadcastAutoDispatchJobPayload>) {
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
