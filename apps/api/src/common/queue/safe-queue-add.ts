import { Logger } from "@nestjs/common";
import type { JobsOptions, Queue } from "bullmq";
import { assertValidBullJobId, BullQueueEnqueueError, InvalidBullJobIdError } from "./bull-job-id";

const logger = new Logger("SafeQueueAdd");

export async function safeQueueAdd(
  queue: Queue,
  jobName: string,
  data: unknown,
  options: JobsOptions & { jobId: string },
  context: Record<string, unknown> = {},
) {
  try {
    assertValidBullJobId(options.jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      JSON.stringify({
        event: "bullmq.invalid_job_id",
        queueName: queue.name,
        jobName,
        jobId: options.jobId,
        message,
        ...context,
      }),
    );
    throw new BullQueueEnqueueError(message, {
      queueName: queue.name,
      jobName,
      jobId: options.jobId,
      invalidJobId: error instanceof InvalidBullJobIdError,
      ...context,
    });
  }
  try {
    return await queue.add(jobName, data, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      JSON.stringify({
        event: "bullmq.enqueue_failed",
        queueName: queue.name,
        jobName,
        jobId: options.jobId,
        message,
        ...context,
      }),
    );
    throw new BullQueueEnqueueError(message, {
      queueName: queue.name,
      jobName,
      jobId: options.jobId,
      ...context,
    });
  }
}
