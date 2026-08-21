import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { DANGER_DETECTION_QUEUE_NAME } from "../../common/queue/queue-names";
import { DangerDetectionService, type DangerDetectionJobPayload } from "./danger-detection.service";

@Processor(DANGER_DETECTION_QUEUE_NAME)
export class DangerDetectionProcessor extends WorkerHost {
  constructor(private readonly dangerDetection: DangerDetectionService) {
    super();
  }

  process(job: Job<DangerDetectionJobPayload>) {
    return this.dangerDetection.process(job.data);
  }
}
