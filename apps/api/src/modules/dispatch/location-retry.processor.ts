import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { INCIDENT_LOCATION_RETRY_QUEUE_NAME } from "../../common/queue/queue-names";
import { isIncidentLocationPersistenceError } from "./location-persistence.error";
import { LocationRetryService, type IncidentLocationRetryJob } from "./location-retry.service";
import { LocationTrackingService } from "./location-tracking.service";

@Processor(INCIDENT_LOCATION_RETRY_QUEUE_NAME)
export class LocationRetryProcessor extends WorkerHost {
  private readonly logger = new Logger(LocationRetryProcessor.name);

  constructor(
    private readonly locationTracking: LocationTrackingService,
    private readonly locationRetry: LocationRetryService,
  ) {
    super();
  }

  async process(job: Job<IncidentLocationRetryJob>) {
    const payload = job.data;
    const actor = payload.reporterId ? ({ sub: payload.reporterId, typ: "user" as const }) : undefined;
    try {
      await this.locationTracking.recordCitizenLocation(payload.incidentId, payload.dto, actor as never);
      this.logger.log(
        JSON.stringify({
          event: "incident.location.retry_succeeded",
          incidentId: payload.incidentId,
          attempt: payload.attempt,
          jobId: job.id,
        }),
      );
      return { status: "ok" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isIncidentLocationPersistenceError(error) && payload.attempt < 3) {
        await this.locationRetry.scheduleRetry({
          incidentId: payload.incidentId,
          dto: payload.dto,
          reporterId: payload.reporterId,
          attempt: payload.attempt + 1,
        });
      }
      this.logger.error(
        JSON.stringify({
          event: "incident.location.retry_failed",
          incidentId: payload.incidentId,
          attempt: payload.attempt,
          jobId: job.id,
          message,
        }),
      );
      throw error;
    }
  }
}
