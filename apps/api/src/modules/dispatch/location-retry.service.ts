import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, Optional } from "@nestjs/common";
import type { Queue } from "bullmq";
import { INCIDENT_LOCATION_RETRY_QUEUE_NAME } from "../../common/queue/queue-names";
import type { LocationUpdateInput } from "./location-tracking.service";

export type IncidentLocationRetryJob = {
  incidentId: string;
  dto: LocationUpdateInput;
  reporterId?: string;
  attempt: number;
};

@Injectable()
export class LocationRetryService {
  private readonly logger = new Logger(LocationRetryService.name);

  constructor(
    @Optional() @InjectQueue(INCIDENT_LOCATION_RETRY_QUEUE_NAME) private readonly queue?: Queue<IncidentLocationRetryJob>,
  ) {}

  async scheduleRetry(payload: Omit<IncidentLocationRetryJob, "attempt"> & { attempt?: number }) {
    const attempt = payload.attempt ?? 1;
    if (!this.queue) {
      this.logger.warn(
        JSON.stringify({
          event: "incident.location.retry_queue_unavailable",
          incidentId: payload.incidentId,
          attempt,
        }),
      );
      return false;
    }

    await this.queue.add(
      "incident.location.retry",
      { ...payload, attempt },
      {
        jobId: `${payload.incidentId}:${payload.dto.sequenceNumber ?? 0}:${attempt}`,
        delay: Math.min(30_000, attempt * 5_000),
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
    return true;
  }
}
