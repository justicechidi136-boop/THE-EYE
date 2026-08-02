import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { WATCH_FLEET_EXPORT_QUEUE_NAME } from "../../common/queue/queue-names";
import { WatchExportService, type WatchExportJobPayload } from "./watch-export.service";

@Processor(WATCH_FLEET_EXPORT_QUEUE_NAME)
export class WatchFleetExportProcessor extends WorkerHost {
  constructor(private readonly exports: WatchExportService) {
    super();
  }

  async process(job: Job<WatchExportJobPayload>) {
    await this.exports.processExportJob(job.data);
  }
}
