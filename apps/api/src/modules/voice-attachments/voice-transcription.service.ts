import { Injectable, Logger, Optional } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import {
  createTranslationIdentity,
  effectivePreferredLocale,
  isEnabledPreferredLocale,
  normalizePreferredLocale,
} from "@the-eye/shared";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import {
  buildSpeechTranslationJobId,
  buildVoiceTranscriptionJobId,
  SPEECH_TRANSLATION_JOB_NAME,
  VOICE_TRANSCRIPTION_JOB_NAME,
} from "../../common/queue/queue-jobs";
import { safeQueueAdd } from "../../common/queue/safe-queue-add";
import { VOICE_TRANSCRIPTION_QUEUE_NAME } from "../../common/queue/queue-names";
import { PrismaService } from "../prisma/prisma.service";
import type { ConfigService } from "@nestjs/config";
import { GoogleTranscriptionProvider, GoogleTranslationProvider } from "./google-speech.provider";
import { OpenAiTranscriptionProvider, OpenAiTranslationProvider } from "./openai-speech.provider";
import { resolveSpeechRuntimeConfig, type SpeechRuntimeConfig } from "./speech-runtime.config";
import { StubTranscriptionProvider } from "./stub-transcription.provider";
import { StubTranslationProvider } from "./stub-translation.provider";
import type { VoiceTranscriptionProvider } from "./transcription-provider.interface";
import type { SpeechTranslationProvider } from "./translation-provider.interface";

export type VoiceTranscriptionJobPayload = {
  attachmentId: string;
  resourceType: "incident_media" | "community_post_media";
  idempotencyKey: string;
};

export type SpeechTranslationJobPayload = {
  speechArtifactId: string;
  targetLocale: string;
  idempotencyKey: string;
};

export type SpeechLanguageJobPayload = VoiceTranscriptionJobPayload | SpeechTranslationJobPayload;

const TRANSCRIPTION_TIMEOUT_MS = 30_000;
const TRANSLATION_TIMEOUT_MS = 15_000;

@Injectable()
export class VoiceTranscriptionService {
  private readonly logger = new Logger(VoiceTranscriptionService.name);
  private readonly transcriptionProvider: VoiceTranscriptionProvider;
  private readonly translationProvider: SpeechTranslationProvider;
  private readonly runtimeConfig: SpeechRuntimeConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stubProvider: StubTranscriptionProvider,
    private readonly stubTranslationProvider: StubTranslationProvider,
    @Optional() @InjectQueue(VOICE_TRANSCRIPTION_QUEUE_NAME) private readonly queue?: Queue,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly openAiTranscriptionProvider?: OpenAiTranscriptionProvider,
    @Optional() private readonly openAiTranslationProvider?: OpenAiTranslationProvider,
    @Optional() private readonly googleTranscriptionProvider?: GoogleTranscriptionProvider,
    @Optional() private readonly googleTranslationProvider?: GoogleTranslationProvider,
  ) {
    this.runtimeConfig = resolveSpeechRuntimeConfig(this.config);
    this.transcriptionProvider = this.resolveTranscriptionProvider();
    this.translationProvider = this.resolveTranslationProvider();
  }

  async enqueueIncidentMediaTranscription(attachmentId: string) {
    if (!this.runtimeConfig.runtimeEnabled) {
      this.logger.warn(`Speech AI runtime disabled; not enqueueing transcription for ${attachmentId}`);
      return;
    }
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
    if (!this.runtimeConfig.runtimeEnabled) {
      this.logger.warn(`Speech AI runtime disabled; not enqueueing transcription for ${attachmentId}`);
      return;
    }
    const media = await this.prisma.communityPostMedia.findUnique({ where: { id: attachmentId } });
    if (!media || media.mediaType !== "Audio") return;
    if (media.deletedAt) return;

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
      idempotencyKey: buildVoiceTranscriptionJobId(attachmentId),
    });
  }

  async enqueue(payload: VoiceTranscriptionJobPayload) {
    if (!this.runtimeConfig.runtimeEnabled) {
      this.logger.warn(`Speech AI runtime disabled; leaving ${payload.attachmentId} without generated transcript`);
      return;
    }
    if (!shouldRegisterBullMq() || !this.queue) {
      this.logger.warn(`Transcription queue unavailable; leaving ${payload.attachmentId} queued for retry`);
      return;
    }

    try {
      const existing = await this.queue.getJob(payload.idempotencyKey);
      if (existing) return;
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

  async requestTranslationForIncidentMedia(attachmentId: string, targetLocale: string) {
    const media = await this.prisma.incidentMedia.findUnique({ where: { id: attachmentId } });
    if (!media || media.mediaType !== "Audio" || media.deletedAt) {
      return { status: "skipped" as const };
    }
    const artifact = await this.findTranscriptArtifact("incident_media", attachmentId);
    if (!artifact || artifact.status !== "COMPLETED" || !artifact.content) {
      return { status: "transcript_unavailable" as const };
    }
    return this.enqueueTranslation(String(artifact.id), targetLocale);
  }

  async enqueueTranslation(speechArtifactId: string, targetLocale: string) {
    if (!this.runtimeConfig.runtimeEnabled) {
      return { status: "runtime_disabled" as const };
    }
    const effectiveTarget = effectivePreferredLocale(targetLocale);
    const artifact = await (this.prisma as any).speechArtifact.findUnique({ where: { id: speechArtifactId } });
    if (!artifact || artifact.provenance !== "TRANSCRIPT" || artifact.status !== "COMPLETED" || !artifact.content) {
      return { status: "transcript_unavailable" as const };
    }

    const sourceLocale = this.supportedLocaleOrNull(artifact.sourceLocale ?? artifact.detectedLocale);
    if (sourceLocale === effectiveTarget) {
      const translation = await (this.prisma as any).speechTranslation.upsert({
        where: { speechArtifactId_targetLocale: { speechArtifactId, targetLocale: effectiveTarget } },
        update: {
          sourceLocale,
          translatedText: artifact.content,
          provider: "same-language-skip",
          status: "COMPLETED",
          errorCode: null,
          generatedAt: new Date(),
        },
        create: {
          speechArtifactId,
          targetLocale: effectiveTarget,
          sourceLocale,
          translatedText: artifact.content,
          provider: "same-language-skip",
          status: "COMPLETED",
          generatedAt: new Date(),
        },
      });
      return { status: "completed" as const, translation };
    }

    const translation = await (this.prisma as any).speechTranslation.upsert({
      where: { speechArtifactId_targetLocale: { speechArtifactId, targetLocale: effectiveTarget } },
      update: { status: "PENDING", errorCode: null },
      create: {
        speechArtifactId,
        targetLocale: effectiveTarget,
        sourceLocale,
        status: "PENDING",
      },
    });

    const idempotencyKey = buildSpeechTranslationJobId(speechArtifactId, effectiveTarget);
    if (!shouldRegisterBullMq() || !this.queue) {
      this.logger.warn(`Translation queue unavailable; leaving ${translation.id} pending for retry`);
      return { status: "queued" as const, translation };
    }

    try {
      const existing = await this.queue.getJob(idempotencyKey);
      if (!existing) {
        await safeQueueAdd(
          this.queue,
          SPEECH_TRANSLATION_JOB_NAME,
          { speechArtifactId, targetLocale: effectiveTarget, idempotencyKey },
          {
            jobId: idempotencyKey,
            attempts: 5,
            backoff: { type: "exponential", delay: 15_000 },
            removeOnComplete: 100,
            removeOnFail: 500,
          },
          { speechArtifactId, targetLocale: effectiveTarget },
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to enqueue translation for artifact ${speechArtifactId}: ${message}`);
    }

    return { status: "queued" as const, translation };
  }

  async processJob(payload: SpeechLanguageJobPayload) {
    if (!this.runtimeConfig.runtimeEnabled) {
      if ("speechArtifactId" in payload) {
        return { status: "runtime_disabled" as const, speechArtifactId: payload.speechArtifactId };
      }
      return this.markTranscriptionUnsupported(payload.resourceType, payload.attachmentId, "LANGUAGE_AI_RUNTIME_DISABLED");
    }
    if ("speechArtifactId" in payload) {
      return this.processTranslation(payload.speechArtifactId, payload.targetLocale);
    }
    if (payload.resourceType === "incident_media") {
      return this.processIncidentMedia(payload.attachmentId);
    }
    if (payload.resourceType === "community_post_media") {
      return this.processCommunityPostMedia(payload.attachmentId);
    }
    return { status: "unsupported_resource" as const };
  }

  private async processIncidentMedia(attachmentId: string) {
    const media = await this.prisma.incidentMedia.findUnique({ where: { id: attachmentId } });
    if (!media || media.mediaType !== "Audio" || media.deletedAt) {
      return { status: "skipped" as const };
    }

    const existingArtifact = await this.findTranscriptArtifact("incident_media", attachmentId);
    if (existingArtifact?.status === "COMPLETED") {
      return { status: "duplicate" as const, attachmentId, speechArtifactId: existingArtifact.id };
    }

    await this.prisma.incidentMedia.update({
      where: { id: attachmentId },
      data: { transcriptionStatus: "Processing" },
    });

    try {
      await this.markArtifactProcessing("incident_media", attachmentId, media.fileHash);
      const result = await this.withTimeout(
        this.transcriptionProvider.transcribe({
          attachmentId,
          storageKey: media.objectKey,
          contentType: media.contentType,
          selectedLanguage: media.selectedLanguage,
          durationSeconds: media.durationSeconds,
        }),
        TRANSCRIPTION_TIMEOUT_MS,
        "TRANSCRIPTION_TIMEOUT",
      );

      const status = result.lowConfidence ? "LowConfidence" : "Completed";
      const sourceLocale = this.supportedLocaleOrNull(result.detectedLanguage ?? media.selectedLanguage);
      const artifact = await (this.prisma as any).speechArtifact.upsert({
        where: { sourceType_sourceId_provenance: { sourceType: "incident_media", sourceId: attachmentId, provenance: "TRANSCRIPT" } },
        update: {
          sourceLocale,
          detectedLocale: result.detectedLanguage,
          languageConfidence: result.languageDetectionConfidence,
          content: result.transcript,
          sourceHash: result.sourceHash ?? media.fileHash,
          provider: this.transcriptionProvider.name,
          model: result.model,
          confidence: result.transcriptionConfidence,
          status: "COMPLETED",
          errorCode: null,
          generatedAt: new Date(),
        },
        create: {
          sourceType: "incident_media",
          sourceId: attachmentId,
          provenance: "TRANSCRIPT",
          sourceLocale,
          detectedLocale: result.detectedLanguage,
          languageConfidence: result.languageDetectionConfidence,
          content: result.transcript,
          sourceHash: result.sourceHash ?? media.fileHash,
          provider: this.transcriptionProvider.name,
          model: result.model,
          confidence: result.transcriptionConfidence,
          status: "COMPLETED",
          generatedAt: new Date(),
        },
      });

      await this.prisma.incidentMedia.update({
        where: { id: attachmentId },
        data: {
          transcriptionStatus: status,
          transcript: result.transcript,
          detectedLanguage: result.detectedLanguage,
          languageDetectionConfidence: result.languageDetectionConfidence,
          transcriptionConfidence: result.transcriptionConfidence,
          transcriptionProvider: this.transcriptionProvider.name,
          transcriptionProcessedAt: new Date(),
          transcriptionErrorCode: null,
        },
      });

      return { status, attachmentId, speechArtifactId: artifact.id };
    } catch (error) {
      const code = error instanceof Error ? error.name : "TRANSCRIPTION_FAILED";
      await this.markArtifactFailed("incident_media", attachmentId, code);
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

  private async processCommunityPostMedia(attachmentId: string) {
    const media = await this.prisma.communityPostMedia.findUnique({ where: { id: attachmentId } });
    if (!media || media.mediaType !== "Audio" || media.deletedAt) {
      return { status: "skipped" as const };
    }

    const existingArtifact = await this.findTranscriptArtifact("community_post_media", attachmentId);
    if (existingArtifact?.status === "COMPLETED") {
      return { status: "duplicate" as const, attachmentId, speechArtifactId: existingArtifact.id };
    }

    await this.prisma.communityPostMedia.update({
      where: { id: attachmentId },
      data: { transcriptionStatus: "Processing" },
    });

    try {
      await this.markArtifactProcessing("community_post_media", attachmentId, media.fileHash);
      const result = await this.withTimeout(
        this.transcriptionProvider.transcribe({
          attachmentId,
          storageKey: media.objectKey,
          contentType: media.contentType,
          selectedLanguage: media.selectedLanguage,
          durationSeconds: media.durationSeconds,
        }),
        TRANSCRIPTION_TIMEOUT_MS,
        "TRANSCRIPTION_TIMEOUT",
      );
      const sourceLocale = this.supportedLocaleOrNull(result.detectedLanguage ?? media.selectedLanguage);
      const artifact = await (this.prisma as any).speechArtifact.upsert({
        where: { sourceType_sourceId_provenance: { sourceType: "community_post_media", sourceId: attachmentId, provenance: "TRANSCRIPT" } },
        update: {
          sourceLocale,
          detectedLocale: result.detectedLanguage,
          languageConfidence: result.languageDetectionConfidence,
          content: result.transcript,
          sourceHash: result.sourceHash ?? media.fileHash,
          provider: this.transcriptionProvider.name,
          model: result.model,
          confidence: result.transcriptionConfidence,
          status: "COMPLETED",
          errorCode: null,
          generatedAt: new Date(),
        },
        create: {
          sourceType: "community_post_media",
          sourceId: attachmentId,
          provenance: "TRANSCRIPT",
          sourceLocale,
          detectedLocale: result.detectedLanguage,
          languageConfidence: result.languageDetectionConfidence,
          content: result.transcript,
          sourceHash: result.sourceHash ?? media.fileHash,
          provider: this.transcriptionProvider.name,
          model: result.model,
          confidence: result.transcriptionConfidence,
          status: "COMPLETED",
          generatedAt: new Date(),
        },
      });
      await this.prisma.communityPostMedia.update({
        where: { id: attachmentId },
        data: {
          transcriptionStatus: result.lowConfidence ? "LowConfidence" : "Completed",
          transcript: result.transcript,
          detectedLanguage: result.detectedLanguage,
          languageDetectionConfidence: result.languageDetectionConfidence,
          transcriptionConfidence: result.transcriptionConfidence,
          transcriptionProvider: this.transcriptionProvider.name,
          transcriptionProcessedAt: new Date(),
          transcriptionErrorCode: null,
        },
      });
      return { status: result.lowConfidence ? "LowConfidence" : "Completed", attachmentId, speechArtifactId: artifact.id };
    } catch (error) {
      const code = error instanceof Error ? error.name : "TRANSCRIPTION_FAILED";
      await this.markArtifactFailed("community_post_media", attachmentId, code);
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

  private async processTranslation(speechArtifactId: string, targetLocale: string) {
    const artifact = await (this.prisma as any).speechArtifact.findUnique({ where: { id: speechArtifactId } });
    if (!artifact || artifact.provenance !== "TRANSCRIPT" || artifact.status !== "COMPLETED" || !artifact.content) {
      return { status: "transcript_unavailable" as const };
    }

    const effectiveTarget = effectivePreferredLocale(targetLocale);
    const sourceLocale = this.supportedLocaleOrNull(artifact.sourceLocale ?? artifact.detectedLocale);
    const translation = await (this.prisma as any).speechTranslation.upsert({
      where: { speechArtifactId_targetLocale: { speechArtifactId, targetLocale: effectiveTarget } },
      update: { status: "PROCESSING", errorCode: null },
      create: { speechArtifactId, targetLocale: effectiveTarget, sourceLocale, status: "PROCESSING" },
    });

    try {
      if (sourceLocale === effectiveTarget) {
        const completed = await (this.prisma as any).speechTranslation.update({
          where: { id: translation.id },
          data: {
            translatedText: artifact.content,
            provider: "same-language-skip",
            status: "COMPLETED",
            generatedAt: new Date(),
          },
        });
        return { status: "COMPLETED", speechArtifactId, translationId: completed.id };
      }

      createTranslationIdentity({
        sourceContentId: speechArtifactId,
        sourceLocale: sourceLocale ?? "en",
        targetLocale: effectiveTarget,
      });

      const result = await this.withTimeout(
        this.translationProvider.translate({
          speechArtifactId,
          sourceContentId: String(artifact.sourceId),
          sourceLocale,
          targetLocale: effectiveTarget,
          text: artifact.content,
        }),
        TRANSLATION_TIMEOUT_MS,
        "TRANSLATION_TIMEOUT",
      );

      const completed = await (this.prisma as any).speechTranslation.update({
        where: { id: translation.id },
        data: {
          sourceLocale,
          translatedText: result.translatedText,
          provider: this.translationProvider.name,
          model: result.model,
          confidence: result.confidence,
          status: "COMPLETED",
          errorCode: null,
          generatedAt: new Date(),
        },
      });

      await this.updateLegacyTranslatedTranscript(artifact.sourceType, artifact.sourceId, result.translatedText);
      return { status: "COMPLETED", speechArtifactId, translationId: completed.id };
    } catch (error) {
      const code = error instanceof Error ? error.name : "TRANSLATION_FAILED";
      await (this.prisma as any).speechTranslation.update({
        where: { id: translation.id },
        data: { status: "FAILED", errorCode: code, generatedAt: new Date() },
      });
      throw error;
    }
  }

  private findTranscriptArtifact(sourceType: "incident_media" | "community_post_media", sourceId: string) {
    return (this.prisma as any).speechArtifact.findUnique({
      where: { sourceType_sourceId_provenance: { sourceType, sourceId, provenance: "TRANSCRIPT" } },
      include: { translations: true },
    });
  }

  private async markArtifactProcessing(sourceType: "incident_media" | "community_post_media", sourceId: string, sourceHash: string) {
    await (this.prisma as any).speechArtifact.upsert({
      where: { sourceType_sourceId_provenance: { sourceType, sourceId, provenance: "TRANSCRIPT" } },
      update: { status: "PROCESSING", errorCode: null },
      create: { sourceType, sourceId, provenance: "TRANSCRIPT", sourceHash, status: "PROCESSING" },
    });
  }

  private async markArtifactFailed(sourceType: "incident_media" | "community_post_media", sourceId: string, errorCode: string) {
    await (this.prisma as any).speechArtifact.upsert({
      where: { sourceType_sourceId_provenance: { sourceType, sourceId, provenance: "TRANSCRIPT" } },
      update: { status: "FAILED", errorCode, generatedAt: new Date() },
      create: { sourceType, sourceId, provenance: "TRANSCRIPT", status: "FAILED", errorCode, generatedAt: new Date() },
    });
  }

  private async updateLegacyTranslatedTranscript(sourceType: string, sourceId: string, translatedText: string) {
    if (sourceType === "incident_media") {
      await this.prisma.incidentMedia.update({ where: { id: sourceId }, data: { translatedTranscript: translatedText } });
    } else if (sourceType === "community_post_media") {
      await this.prisma.communityPostMedia.update({ where: { id: sourceId }, data: { translatedTranscript: translatedText } });
    }
  }

  private supportedLocaleOrNull(locale: string | null | undefined) {
    const normalized = normalizePreferredLocale(locale);
    return isEnabledPreferredLocale(normalized) ? normalized : null;
  }

  private resolveTranscriptionProvider(): VoiceTranscriptionProvider {
    if (this.runtimeConfig.sttProvider === "openai" && this.openAiTranscriptionProvider) return this.openAiTranscriptionProvider;
    if (this.runtimeConfig.sttProvider === "google" && this.googleTranscriptionProvider) return this.googleTranscriptionProvider;
    return this.stubProvider;
  }

  private resolveTranslationProvider(): SpeechTranslationProvider {
    if (this.runtimeConfig.translationProvider === "openai" && this.openAiTranslationProvider) return this.openAiTranslationProvider;
    if (this.runtimeConfig.translationProvider === "google" && this.googleTranslationProvider) return this.googleTranslationProvider;
    return this.stubTranslationProvider;
  }

  private async markTranscriptionUnsupported(
    sourceType: "incident_media" | "community_post_media",
    attachmentId: string,
    errorCode: string,
  ) {
    await (this.prisma as any).speechArtifact.upsert({
      where: { sourceType_sourceId_provenance: { sourceType, sourceId: attachmentId, provenance: "TRANSCRIPT" } },
      update: { status: "UNSUPPORTED", errorCode, generatedAt: new Date() },
      create: { sourceType, sourceId: attachmentId, provenance: "TRANSCRIPT", status: "UNSUPPORTED", errorCode, generatedAt: new Date() },
    });
    return { status: "runtime_disabled" as const, attachmentId };
  }

  private async withTimeout<T>(operation: Promise<T>, timeoutMs: number, code: string): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            const error = new Error(code);
            error.name = code;
            reject(error);
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
