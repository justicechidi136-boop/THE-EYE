import { Injectable } from "@nestjs/common";
import { BroadcastQueueService } from "./broadcast-queue.service";
import { BroadcastLifecycleService } from "./broadcast-lifecycle.service";
import { BROADCAST_SYSTEM_ACTOR } from "./broadcasts.service";

@Injectable()
export class BroadcastExpirySchedulerService {
  constructor(
    private readonly lifecycle: BroadcastLifecycleService,
    private readonly broadcastQueue: BroadcastQueueService,
  ) {}

  async reviewUpcomingExpiries(limit = 25) {
    const ids = await this.lifecycle.claimExpiryCandidates(limit);
    let queued = 0;
    for (const id of ids) {
      const result = await this.broadcastQueue.enqueueExpiryReview(id);
      if (result.queued || result.duplicate) queued += 1;
    }
    return { claimed: ids.length, queued };
  }

  async processExpiryReview(broadcastId: string) {
    return this.lifecycle.sendExpiryReminder(broadcastId, BROADCAST_SYSTEM_ACTOR);
  }
}
