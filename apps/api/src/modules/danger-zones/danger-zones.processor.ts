import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { DANGER_ZONES_QUEUE_NAME } from "../../common/queue/queue-names";
import { DANGER_ZONE_TARGET_JOB_NAME } from "../../common/queue/queue-jobs";
import { DangerZoneDeliveryService } from "./danger-zone-delivery.service";

@Processor(DANGER_ZONES_QUEUE_NAME)
export class DangerZonesProcessor extends WorkerHost {
  private readonly logger = new Logger(DangerZonesProcessor.name);

  constructor(private readonly delivery: DangerZoneDeliveryService) {
    super();
  }

  async process(job: Job<{ dangerZoneId: string }>) {
    if (job.name !== DANGER_ZONE_TARGET_JOB_NAME) return;
    this.logger.log(`Dispatching danger zone activation ${job.data.dangerZoneId}`);
    return this.delivery.dispatchZoneActivation(job.data.dangerZoneId);
  }
}
