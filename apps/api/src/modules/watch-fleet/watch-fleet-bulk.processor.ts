import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { WATCH_FLEET_BULK_QUEUE_NAME } from "../../common/queue/queue-names";
import { WatchBulkService, type BulkWatchJobPayload } from "./watch-bulk.service";

@Processor(WATCH_FLEET_BULK_QUEUE_NAME)
export class WatchFleetBulkProcessor extends WorkerHost {
  constructor(private readonly bulk: WatchBulkService) {
    super();
  }

  async process(job: Job<BulkWatchJobPayload>) {
    await this.bulk.processBulkJob(job.data);
  }
}
