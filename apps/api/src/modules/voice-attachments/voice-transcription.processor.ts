import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { VOICE_TRANSCRIPTION_QUEUE_NAME } from "../../common/queue/queue-names";
import { MetricsService } from "../../common/metrics/metrics.service";
import type { SpeechLanguageJobPayload } from "./voice-transcription.service";
import { VoiceTranscriptionService } from "./voice-transcription.service";

@Processor(VOICE_TRANSCRIPTION_QUEUE_NAME)
export class VoiceTranscriptionProcessor extends WorkerHost {
  private readonly logger = new Logger(VoiceTranscriptionProcessor.name);

  constructor(
    private readonly transcription: VoiceTranscriptionService,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<SpeechLanguageJobPayload>) {
    const startedAt = process.hrtime.bigint();
    try {
      const result = await this.transcription.processJob(job.data);
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      this.metrics.recordQueueJob(VOICE_TRANSCRIPTION_QUEUE_NAME, "completed");
      this.logger.log(`Speech language job ${job.name} completed in ${durationSeconds.toFixed(2)}s`);
      return result;
    } catch (error) {
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      this.metrics.recordQueueJob(VOICE_TRANSCRIPTION_QUEUE_NAME, "failed");
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Speech language job ${job.name} failed after ${durationSeconds.toFixed(2)}s: ${message}`);
      throw error;
    }
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<SpeechLanguageJobPayload> | undefined, error: Error) {
    if (!job) return;
    this.logger.error(`Speech language job ${job.id} failed permanently: ${error.message}`);
  }
}
