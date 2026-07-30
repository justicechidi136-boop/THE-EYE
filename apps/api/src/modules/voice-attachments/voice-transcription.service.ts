import { Injectable, Logger, Optional } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { buildVoiceTranscriptionJobId, VOICE_TRANSCRIPTION_JOB_NAME } from "../../common/queue/queue-jobs";
import { safeQueueAdd } from "../../common/queue/safe-queue-add";
import { VOICE_TRANSCRIPTION_QUEUE_NAME } from "../../common/queue/queue-names";
import { PrismaService } from "../prisma/prisma.service";
import { StubTranscriptionProvider } from "./stub-transcription.provider";
import type { VoiceTranscriptionProvider } from "./transcription-provider.interface";

export type VoiceTranscriptionJobPayload = {
  attachmentId: string;
  resourceType: "incident_media" | "community_post_media" | "community_comment_media";
  idempotencyKey: string;
};

@Injectable()
export class VoiceTranscriptionService {
  private readonly logger = new Logger(VoiceTranscriptionService.name);
  private readonly provider: VoiceTranscriptionProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stubProvider: StubTranscriptionProvider,
    @Optional() @InjectQueue(VOICE_TRANSCRIPTION_QUEUE_NAME) private readonly queue?: Queue,
  ) {
    this.provider = this.stubProvider;
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

    await this.prisma.communityPostMedia.update({
      where: { id: attachmentId },
      data: { transcriptionStatus: "Processing" },
    });

    try {
      const result = await this.provider.transcribe({
        attachmentId,
        storageKey: media.objectKey,
        contentType: media.contentType,
        selectedLanguage: media.selectedLanguage,
        durationSeconds: media.durationSeconds,
      });
      const status = result.lowConfidence ? "LowConfidence" : "Completed";
      await this.prisma.communityPostMedia.update({
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
        },
      });
      return { status, attachmentId };
    } catch (error) {
      const code = error instanceof Error ? error.name : "TRANSCRIPTION_FAILED";
      await this.prisma.communityPostMedia.update({
        where: { id: attachmentId },
        data: {
          transcriptionStatus: "Failed",
          transcriptionErrorCode: code,
          transcriptionProcessedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async processCommunityCommentMedia(attachmentId: string) {
    const media = await this.prisma.communityCommentMedia.findUnique({ where: { id: attachmentId } });
    if (!media || media.mediaType !== "Audio" || media.deletedAt) {
      return { status: "skipped" as const };
    }

    await this.prisma.communityCommentMedia.update({
      where: { id: attachmentId },
      data: { transcriptionStatus: "Processing" },
    });

    try {
      const result = await this.provider.transcribe({
        attachmentId,
        storageKey: media.objectKey,
        contentType: media.contentType,
        selectedLanguage: media.selectedLanguage,
        durationSeconds: media.durationSeconds,
      });
      const status = result.lowConfidence ? "LowConfidence" : "Completed";
      await this.prisma.communityCommentMedia.update({
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
        },
      });
      return { status, attachmentId };
    } catch (error) {
      const code = error instanceof Error ? error.name : "TRANSCRIPTION_FAILED";
      await this.prisma.communityCommentMedia.update({
        where: { id: attachmentId },
        data: {
          transcriptionStatus: "Failed",
          transcriptionErrorCode: code,
          transcriptionProcessedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async processIncidentMedia(attachmentId: string) {
    const media = await this.prisma.incidentMedia.findUnique({ where: { id: attachmentId } });
    if (!media || media.mediaType !== "Audio" || media.deletedAt) {
      return { status: "skipped" as const };
    }

    await this.prisma.incidentMedia.update({
      where: { id: attachmentId },
      data: { transcriptionStatus: "Processing" },
    });

    try {
      const result = await this.provider.transcribe({
        attachmentId,
        storageKey: media.objectKey,
        contentType: media.contentType,
        selectedLanguage: media.selectedLanguage,
        durationSeconds: media.durationSeconds,
      });

      const status = result.lowConfidence ? "LowConfidence" : "Completed";
      await this.prisma.incidentMedia.update({
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
        },
      });

      return { status, attachmentId };
    } catch (error) {
      const code = error instanceof Error ? error.name : "TRANSCRIPTION_FAILED";
      await this.prisma.incidentMedia.update({
        where: { id: attachmentId },
        data: {
          transcriptionStatus: "Failed",
          transcriptionErrorCode: code,
          transcriptionProcessedAt: new Date(),
        },
      });
      throw error;
    }
  }
}
