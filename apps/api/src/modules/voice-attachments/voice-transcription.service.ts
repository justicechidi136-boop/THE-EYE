import { Injectable, Logger, Optional } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { MetricsService } from "../../common/metrics/metrics.service";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { buildVoiceTranscriptionJobId, VOICE_TRANSCRIPTION_JOB_NAME } from "../../common/queue/queue-jobs";
import { safeQueueAdd } from "../../common/queue/safe-queue-add";
import { VOICE_TRANSCRIPTION_QUEUE_NAME } from "../../common/queue/queue-names";
import { PrismaService } from "../prisma/prisma.service";
import { TranscriptionProviderFactory } from "./transcription-provider.factory";
import type { TranscriptionResult, VoiceTranscriptionProvider } from "./transcription-provider.interface";
import { VoicePostProcessingService } from "./voice-post-processing.service";

export type VoiceTranscriptionJobPayload = {
  attachmentId: string;
  resourceType: "incident_media" | "community_post_media" | "community_comment_media";
  idempotencyKey: string;
};

type VoiceMediaRecord = {
  objectKey: string;
  contentType: string;
  selectedLanguage: string | null;
  durationSeconds: number | null;
};

@Injectable()
export class VoiceTranscriptionService {
  private readonly logger = new Logger(VoiceTranscriptionService.name);
  private readonly provider: VoiceTranscriptionProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: TranscriptionProviderFactory,
    private readonly postProcessing: VoicePostProcessingService,
    private readonly metrics: MetricsService,
    @Optional() @InjectQueue(VOICE_TRANSCRIPTION_QUEUE_NAME) private readonly queue?: Queue,
  ) {
    this.provider = this.providerFactory.getProvider();
  }

  async enqueueIncidentMediaTranscription(attachmentId: string) {
    const media = await this.prisma.incidentMedia.findUnique({ where: { id: attachmentId } });
    if (!media || media.mediaType !== "Audio") return;
    if (media.deletedAt) return;

    await this.prisma.incidentMedia.update({
      where: { id: attachmentId },
      data: {
        transcriptionStatus: "Queued",
        moderationStatus: media.moderationStatus ?? "Pending",
      },
    });

    await this.enqueue({
      attachmentId,
      resourceType: "incident_media",
      idempotencyKey: buildVoiceTranscriptionJobId(attachmentId),
    });
  }

  async enqueueCommunityPostMediaTranscription(attachmentId: string) {
    const media = await this.prisma.communityPostMedia.findUnique({ where: { id: attachmentId } });
    if (!media || media.mediaType !== "Audio" || media.deletedAt) return;

    await this.prisma.communityPostMedia.update({
      where: { id: attachmentId },
      data: {
        transcriptionStatus: "Queued",
        moderationStatus: media.moderationStatus ?? "Pending",
      },
    });

    await this.enqueue({
      attachmentId,
      resourceType: "community_post_media",
      idempotencyKey: buildVoiceTranscriptionJobId(`post-${attachmentId}`),
    });
  }

  async enqueueCommunityCommentMediaTranscription(attachmentId: string) {
    const media = await this.prisma.communityCommentMedia.findUnique({ where: { id: attachmentId } });
    if (!media || media.mediaType !== "Audio" || media.deletedAt) return;

    await this.prisma.communityCommentMedia.update({
      where: { id: attachmentId },
      data: {
        transcriptionStatus: "Queued",
        moderationStatus: media.moderationStatus ?? "Pending",
      },
    });

    await this.enqueue({
      attachmentId,
      resourceType: "community_comment_media",
      idempotencyKey: buildVoiceTranscriptionJobId(`comment-${attachmentId}`),
    });
  }

  async enqueue(payload: VoiceTranscriptionJobPayload) {
    if (!shouldRegisterBullMq() || !this.queue) {
      this.logger.warn(`Transcription queue unavailable; leaving ${payload.attachmentId} queued for retry`);
      return;
    }

    try {
      await safeQueueAdd(
        this.queue,
        VOICE_TRANSCRIPTION_JOB_NAME,
        payload,
        {
          jobId: payload.idempotencyKey,
          attempts: 5,
          backoff: { type: "exponential", delay: 15_000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
        { attachmentId: payload.attachmentId, resourceType: payload.resourceType },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to enqueue transcription for ${payload.attachmentId}: ${message}`);
    }
  }

  async processJob(payload: VoiceTranscriptionJobPayload) {
    if (payload.resourceType === "incident_media") {
      return this.processIncidentMedia(payload.attachmentId);
    }
    if (payload.resourceType === "community_post_media") {
      return this.processCommunityPostMedia(payload.attachmentId);
    }
    if (payload.resourceType === "community_comment_media") {
      return this.processCommunityCommentMedia(payload.attachmentId);
    }
    return { status: "unsupported_resource" as const };
  }

  private async processCommunityPostMedia(attachmentId: string) {
    const media = await this.prisma.communityPostMedia.findUnique({ where: { id: attachmentId } });
    if (!media || media.mediaType !== "Audio" || media.deletedAt) {
      return { status: "skipped" as const };
    }

    return this.processMedia({
      attachmentId,
      resourceType: "community_post_media",
      media,
      markProcessing: () =>
        this.prisma.communityPostMedia.update({
          where: { id: attachmentId },
          data: { transcriptionStatus: "Processing" },
        }),
      persistSuccess: (status, result, postProcessing) =>
        this.prisma.communityPostMedia.update({
          where: { id: attachmentId },
          data: {
            transcriptionStatus: status,
            transcript: result.transcript,
            detectedLanguage: result.detectedLanguage,
            languageDetectionConfidence: result.languageDetectionConfidence,
            transcriptionConfidence: result.transcriptionConfidence,
            transcriptionProvider: this.provider.name,
            transcriptionProcessedAt: new Date(),
            transcriptionErrorCode: null,
            translatedTranscript: postProcessing.translatedTranscript,
            moderationStatus: postProcessing.moderationStatus,
          },
        }),
      persistFailure: (code) =>
        this.prisma.communityPostMedia.update({
          where: { id: attachmentId },
          data: {
            transcriptionStatus: "Failed",
            transcriptionErrorCode: code,
            transcriptionProcessedAt: new Date(),
          },
        }),
    });
  }

  private async processCommunityCommentMedia(attachmentId: string) {
    const media = await this.prisma.communityCommentMedia.findUnique({ where: { id: attachmentId } });
    if (!media || media.mediaType !== "Audio" || media.deletedAt) {
      return { status: "skipped" as const };
    }

    return this.processMedia({
      attachmentId,
      resourceType: "community_comment_media",
      media,
      markProcessing: () =>
        this.prisma.communityCommentMedia.update({
          where: { id: attachmentId },
          data: { transcriptionStatus: "Processing" },
        }),
      persistSuccess: (status, result, postProcessing) =>
        this.prisma.communityCommentMedia.update({
          where: { id: attachmentId },
          data: {
            transcriptionStatus: status,
            transcript: result.transcript,
            detectedLanguage: result.detectedLanguage,
            languageDetectionConfidence: result.languageDetectionConfidence,
            transcriptionConfidence: result.transcriptionConfidence,
            transcriptionProvider: this.provider.name,
            transcriptionProcessedAt: new Date(),
            transcriptionErrorCode: null,
            translatedTranscript: postProcessing.translatedTranscript,
            moderationStatus: postProcessing.moderationStatus,
          },
        }),
      persistFailure: (code) =>
        this.prisma.communityCommentMedia.update({
          where: { id: attachmentId },
          data: {
            transcriptionStatus: "Failed",
            transcriptionErrorCode: code,
            transcriptionProcessedAt: new Date(),
          },
        }),
    });
  }

  private async processIncidentMedia(attachmentId: string) {
    const media = await this.prisma.incidentMedia.findUnique({ where: { id: attachmentId } });
    if (!media || media.mediaType !== "Audio" || media.deletedAt) {
      return { status: "skipped" as const };
    }

    return this.processMedia({
      attachmentId,
      resourceType: "incident_media",
      media,
      markProcessing: () =>
        this.prisma.incidentMedia.update({
          where: { id: attachmentId },
          data: { transcriptionStatus: "Processing" },
        }),
      persistSuccess: (status, result, postProcessing) =>
        this.prisma.incidentMedia.update({
          where: { id: attachmentId },
          data: {
            transcriptionStatus: status,
            transcript: result.transcript,
            detectedLanguage: result.detectedLanguage,
            languageDetectionConfidence: result.languageDetectionConfidence,
            transcriptionConfidence: result.transcriptionConfidence,
            transcriptionProvider: this.provider.name,
            transcriptionProcessedAt: new Date(),
            transcriptionErrorCode: null,
            translatedTranscript: postProcessing.translatedTranscript,
            moderationStatus: postProcessing.moderationStatus,
          },
        }),
      persistFailure: (code) =>
        this.prisma.incidentMedia.update({
          where: { id: attachmentId },
          data: {
            transcriptionStatus: "Failed",
            transcriptionErrorCode: code,
            transcriptionProcessedAt: new Date(),
          },
        }),
    });
  }

  private async processMedia(params: {
    attachmentId: string;
    resourceType: VoiceTranscriptionJobPayload["resourceType"];
    media: VoiceMediaRecord;
    markProcessing: () => Promise<unknown>;
    persistSuccess: (
      status: "Completed" | "LowConfidence",
      result: TranscriptionResult,
      postProcessing: Awaited<ReturnType<VoicePostProcessingService["process"]>>,
    ) => Promise<unknown>;
    persistFailure: (code: string) => Promise<unknown>;
  }) {
    await params.markProcessing();

    try {
      const result = await this.provider.transcribe({
        attachmentId: params.attachmentId,
        storageKey: params.media.objectKey,
        contentType: params.media.contentType,
        selectedLanguage: params.media.selectedLanguage,
        durationSeconds: params.media.durationSeconds,
      });

      const status = result.lowConfidence ? "LowConfidence" : "Completed";
      const postProcessing = await this.postProcessing.process({
        attachmentId: params.attachmentId,
        resourceType: params.resourceType,
        transcript: result.transcript,
        selectedLanguage: params.media.selectedLanguage,
        detectedLanguage: result.detectedLanguage,
      });

      await params.persistSuccess(status, result, postProcessing);
      this.metrics.recordVoiceTranscription(
        params.resourceType,
        status,
        result.detectedLanguage ?? params.media.selectedLanguage ?? "auto",
      );

      return { status, attachmentId: params.attachmentId };
    } catch (error) {
      const code = error instanceof Error ? error.name : "TRANSCRIPTION_FAILED";
      await params.persistFailure(code);
      this.metrics.recordVoiceTranscription(params.resourceType, "Failed", params.media.selectedLanguage ?? "auto");
      throw error;
    }
  }
}
