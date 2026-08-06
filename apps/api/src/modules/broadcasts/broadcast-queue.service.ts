import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Optional, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Queue } from "bullmq";
import {
  BROADCAST_AUTO_DISPATCH_JOB_NAME,
  BROADCAST_COUNTRY_DELIVERY_JOB_NAME,
  BROADCAST_EXPIRY_REVIEW_JOB_NAME,
  BROADCAST_RESOLUTION_DELIVERY_JOB_NAME,
  buildBroadcastAutoDispatchJobId,
  buildBroadcastCountryDeliveryJobId,
  buildBroadcastExpiryReviewJobId,
  buildBroadcastResolutionDeliveryJobId,
  type BroadcastAutoDispatchJobPayload,
  type BroadcastCountryDeliveryJobPayload,
  type BroadcastExpiryReviewJobPayload,
  type BroadcastResolutionDeliveryJobPayload,
} from "../../common/queue/queue-jobs";
import { BullQueueEnqueueError } from "../../common/queue/bull-job-id";
import { safeQueueAdd } from "../../common/queue/safe-queue-add";
import { isProductionLikeAppEnvironment, isRedisExplicitlyDisabled } from "../../common/queue/queue-config";
import { BROADCASTS_QUEUE_NAME } from "../../common/queue/queue-names";

export type BroadcastEnqueueResult = {
  jobId: string | null;
  queued: boolean;
  duplicate: boolean;
};

@Injectable()
export class BroadcastQueueService {
  constructor(
    private readonly config: ConfigService,
    @Optional() @InjectQueue(BROADCASTS_QUEUE_NAME) private readonly queue?: Queue,
  ) {}

  async enqueueAutoDispatch(broadcastId: string): Promise<BroadcastEnqueueResult> {
    const jobId = buildBroadcastAutoDispatchJobId(broadcastId);
    const payload: BroadcastAutoDispatchJobPayload = { broadcastId, idempotencyKey: jobId };

    if (isRedisExplicitlyDisabled()) {
      if (!isProductionLikeAppEnvironment({ THE_EYE_APP_ENV: this.config.get<string>("THE_EYE_APP_ENV") })) {
        return { jobId: null, queued: false, duplicate: false };
      }
      throw new ServiceUnavailableException("Broadcast dispatch queue unavailable");
    }

    if (!this.queue) {
      throw new ServiceUnavailableException("Broadcast dispatch queue unavailable");
    }

    const existing = await this.queue.getJob(jobId);
    if (existing) {
      return { jobId, queued: false, duplicate: true };
    }

    try {
      await safeQueueAdd(
        this.queue,
        BROADCAST_AUTO_DISPATCH_JOB_NAME,
        payload,
        {
          jobId,
          attempts: 5,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
        { broadcastId },
      );
    } catch (error) {
      if (error instanceof BullQueueEnqueueError) {
        throw new ServiceUnavailableException({
          status: "unavailable",
          code: "BROADCAST_QUEUE_ENQUEUE_FAILED",
          message: "Broadcast dispatch queue rejected the job",
          broadcastId,
          jobId,
        });
      }
      throw error;
    }

    return { jobId, queued: true, duplicate: false };
  }

  async enqueueCountryDelivery(
    broadcastId: string,
    countryCode: string,
    batchNumber: number,
  ): Promise<BroadcastEnqueueResult> {
    const jobId = buildBroadcastCountryDeliveryJobId(broadcastId, countryCode, batchNumber);
    const payload: BroadcastCountryDeliveryJobPayload = {
      broadcastId,
      countryCode,
      batchNumber,
      batchSize: 100,
      idempotencyKey: jobId,
    };

    if (isRedisExplicitlyDisabled()) {
      if (!isProductionLikeAppEnvironment({ THE_EYE_APP_ENV: this.config.get<string>("THE_EYE_APP_ENV") })) {
        return { jobId: null, queued: false, duplicate: false };
      }
      throw new ServiceUnavailableException("Broadcast delivery queue unavailable");
    }
    if (!this.queue) throw new ServiceUnavailableException("Broadcast delivery queue unavailable");

    const existing = await this.queue.getJob(jobId);
    if (existing) return { jobId, queued: false, duplicate: true };

    await safeQueueAdd(
      this.queue,
      BROADCAST_COUNTRY_DELIVERY_JOB_NAME,
      payload,
      {
        jobId,
        attempts: 5,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
      { broadcastId, countryCode, batchNumber: String(batchNumber) },
    );
    return { jobId, queued: true, duplicate: false };
  }

  async enqueueResolutionDelivery(
    broadcastId: string,
    eventType: string,
    batchNumber: number,
  ): Promise<BroadcastEnqueueResult> {
    const jobId = buildBroadcastResolutionDeliveryJobId(broadcastId, eventType, batchNumber);
    const payload: BroadcastResolutionDeliveryJobPayload = {
      broadcastId,
      eventType,
      batchNumber,
      batchSize: 100,
      idempotencyKey: jobId,
    };
    if (isRedisExplicitlyDisabled()) {
      if (!isProductionLikeAppEnvironment({ THE_EYE_APP_ENV: this.config.get<string>("THE_EYE_APP_ENV") })) {
        return { jobId: null, queued: false, duplicate: false };
      }
      throw new ServiceUnavailableException("Broadcast delivery queue unavailable");
    }
    if (!this.queue) throw new ServiceUnavailableException("Broadcast delivery queue unavailable");
    const existing = await this.queue.getJob(jobId);
    if (existing) return { jobId, queued: false, duplicate: true };
    await safeQueueAdd(
      this.queue,
      BROADCAST_RESOLUTION_DELIVERY_JOB_NAME,
      payload,
      { jobId, attempts: 5, backoff: { type: "exponential", delay: 5_000 }, removeOnComplete: true, removeOnFail: false },
      { broadcastId, eventType, batchNumber: String(batchNumber) },
    );
    return { jobId, queued: true, duplicate: false };
  }

  async enqueueExpiryReview(broadcastId: string): Promise<BroadcastEnqueueResult> {
    const jobId = buildBroadcastExpiryReviewJobId(broadcastId);
    const payload: BroadcastExpiryReviewJobPayload = { broadcastId, idempotencyKey: jobId };
    if (isRedisExplicitlyDisabled()) {
      if (!isProductionLikeAppEnvironment({ THE_EYE_APP_ENV: this.config.get<string>("THE_EYE_APP_ENV") })) {
        return { jobId: null, queued: false, duplicate: false };
      }
      throw new ServiceUnavailableException("Broadcast delivery queue unavailable");
    }
    if (!this.queue) throw new ServiceUnavailableException("Broadcast delivery queue unavailable");
    const existing = await this.queue.getJob(jobId);
    if (existing) return { jobId, queued: false, duplicate: true };
    await safeQueueAdd(
      this.queue,
      BROADCAST_EXPIRY_REVIEW_JOB_NAME,
      payload,
      { jobId, attempts: 3, backoff: { type: "exponential", delay: 5_000 }, removeOnComplete: true, removeOnFail: false },
      { broadcastId },
    );
    return { jobId, queued: true, duplicate: false };
  }
}
