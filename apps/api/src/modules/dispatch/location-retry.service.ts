import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, Optional } from "@nestjs/common";
import type { Queue } from "bullmq";
import { INCIDENT_LOCATION_RETRY_QUEUE_NAME } from "../../common/queue/queue-names";
import type { LocationUpdateInput } from "./location-tracking.service";
import {
  buildIncidentLocationRetryJobId,
  resolveLocationRetryIdempotencyKey,
} from "./location-retry-idempotency";

export type IncidentLocationRetryJob = {
  incidentId: string;
  dto: LocationUpdateInput;
  reporterId?: string;
  requestId?: string;
  idempotencyKey?: string;
};

export type LocationRetryScheduleResult =
  | { accepted: true; retryId: string; duplicate: boolean }
  | { accepted: false; reason: "queue_unavailable" };

@Injectable()
export class LocationRetryService {
  private readonly logger = new Logger(LocationRetryService.name);

  constructor(
    @Optional() @InjectQueue(INCIDENT_LOCATION_RETRY_QUEUE_NAME) private readonly queue?: Queue<IncidentLocationRetryJob>,
  ) {}

  async scheduleRetry(payload: IncidentLocationRetryJob): Promise<LocationRetryScheduleResult> {
    const idempotencyKey = resolveLocationRetryIdempotencyKey(payload);
    const retryId = buildIncidentLocationRetryJobId(idempotencyKey);

    if (!this.queue) {
      this.logger.warn(
        JSON.stringify({
          event: "incident.location.retry_queue_unavailable",
          incidentId: payload.incidentId,
          retryId,
          idempotencyKey,
        }),
      );
      return { accepted: false, reason: "queue_unavailable" };
    }

    const existing = await this.queue.getJob(retryId);
    if (existing) {
      const state = await existing.getState();
      if (state === "completed") {
        this.logger.log(
          JSON.stringify({
            event: "incident.location.retry_already_completed",
            incidentId: payload.incidentId,
            retryId,
            idempotencyKey,
          }),
        );
        return { accepted: true, retryId, duplicate: true };
      }
      if (state === "active" || state === "waiting" || state === "delayed" || state === "prioritized") {
        this.logger.log(
          JSON.stringify({
            event: "incident.location.retry_already_queued",
            incidentId: payload.incidentId,
            retryId,
            idempotencyKey,
            state,
          }),
        );
        return { accepted: true, retryId, duplicate: true };
      }
    }

    await this.queue.add(
      "incident.location.retry",
      { ...payload, idempotencyKey },
      {
        jobId: retryId,
        delay: 0,
        attempts: 5,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
    this.logger.log(
      JSON.stringify({
        event: "incident.location.retry_enqueued",
        incidentId: payload.incidentId,
        retryId,
        idempotencyKey,
        sequenceNumber: payload.dto.sequenceNumber ?? 0,
      }),
    );
    return { accepted: true, retryId, duplicate: false };
  }
}
