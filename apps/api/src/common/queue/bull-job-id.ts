/** BullMQ uses ":" as a Redis key segment delimiter; custom job IDs must not contain it. */
export const BULLMQ_JOB_ID_FORBIDDEN_CHAR = ":";
export const BULLMQ_JOB_ID_MAX_LENGTH = 512;

export class InvalidBullJobIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBullJobIdError";
  }
}

export class BullQueueEnqueueError extends Error {
  constructor(
    message: string,
    readonly context: Record<string, unknown>,
  ) {
    super(message);
    this.name = "BullQueueEnqueueError";
  }
}

export function sanitizeBullJobIdSegment(segment: string | number | null | undefined): string {
  const value = String(segment ?? "unknown")
    .trim()
    .replaceAll(BULLMQ_JOB_ID_FORBIDDEN_CHAR, "_")
    .replace(/\s+/g, "-");
  return value.length > 0 ? value : "unknown";
}

export function buildBullJobId(...segments: Array<string | number | null | undefined>): string {
  const jobId = segments.map(sanitizeBullJobIdSegment).join("-");
  assertValidBullJobId(jobId);
  return jobId;
}

export function assertValidBullJobId(jobId: string): void {
  if (!jobId.trim()) {
    throw new InvalidBullJobIdError("BullMQ job id must be a non-empty string");
  }
  if (jobId.includes(BULLMQ_JOB_ID_FORBIDDEN_CHAR)) {
    throw new InvalidBullJobIdError(`BullMQ job id cannot contain "${BULLMQ_JOB_ID_FORBIDDEN_CHAR}"`);
  }
  if (`${parseInt(jobId, 10)}` === jobId) {
    throw new InvalidBullJobIdError("BullMQ job id cannot be an integer");
  }
  if (jobId.length > BULLMQ_JOB_ID_MAX_LENGTH) {
    throw new InvalidBullJobIdError(`BullMQ job id exceeds max length (${BULLMQ_JOB_ID_MAX_LENGTH})`);
  }
}
