import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { INCIDENT_LOCATION_RETRY_QUEUE_NAME } from "../../common/queue/queue-names";
import { LocationTrackingService } from "./location-tracking.service";
import type { IncidentLocationRetryJob } from "./location-retry.service";

@Processor(INCIDENT_LOCATION_RETRY_QUEUE_NAME)
export class LocationRetryProcessor extends WorkerHost {
  private readonly logger = new Logger(LocationRetryProcessor.name);

  constructor(private readonly locationTracking: LocationTrackingService) {
    super();
  }

  async process(job: Job<IncidentLocationRetryJob>) {
    const payload = job.data;
    const actor = payload.reporterId ? ({ sub: payload.reporterId, typ: "user" as const }) : undefined;
    try {
      await this.locationTracking.persistIncidentLocation(
        payload.incidentId,
        payload.dto,
        actor as never,
        {
          idempotencyKey: payload.idempotencyKey,
          requestId: payload.requestId,
        },
      );
      this.logger.log(
        JSON.stringify({
          event: "incident.location.retry_succeeded",
          incidentId: payload.incidentId,
          jobId: job.id,
          idempotencyKey: payload.idempotencyKey,
          sequenceNumber: payload.dto.sequenceNumber ?? 0,
        }),
      );
      return { status: "ok" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        JSON.stringify({
          event: "incident.location.retry_failed",
          incidentId: payload.incidentId,
          jobId: job.id,
          idempotencyKey: payload.idempotencyKey,
          sequenceNumber: payload.dto.sequenceNumber ?? 0,
          message,
        }),
      );
      throw error;
    }
  }
}
