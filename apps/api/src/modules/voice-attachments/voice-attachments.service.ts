import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { effectivePreferredLocale, isEnabledPreferredLocale, normalizePreferredLocale } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { createStorageDownloadUrl } from "../../common/storage/s3-presign";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { VoiceTranscriptionService } from "./voice-transcription.service";
import { isSupportedVoiceLanguage } from "./voice-language";

@Injectable()
export class VoiceAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly transcription: VoiceTranscriptionService,
  ) {}

  async getIncidentVoiceAttachment(incidentId: string, mediaId: string, actor?: JwtPayload) {
    const media = await this.prisma.incidentMedia.findFirst({
      where: { id: mediaId, incidentId, deletedAt: null },
    });
    if (!media || media.mediaType !== "Audio") throw new NotFoundException("Voice attachment not found");
    return media;
  }

  async getPlaybackUrl(incidentId: string, mediaId: string, actor?: JwtPayload) {
    const media = await this.getIncidentVoiceAttachment(incidentId, mediaId, actor);
    await this.audit.record({
      actor,
      action: "voice.playback_requested",
      entityType: "incident_media",
      entityId: mediaId,
      reason: "Voice attachment playback URL issued",
      metadata: { incidentId, fileHash: media.fileHash },
    });

    const signed = await createStorageDownloadUrl(media.objectKey, 300);
    return {
      mediaId: media.id,
      signedUrl: signed.url,
      expiresInSeconds: signed.expiresInSeconds,
      durationSeconds: media.durationSeconds,
      transcriptionStatus: media.transcriptionStatus,
      transcript: media.transcript,
      translatedTranscript: media.translatedTranscript,
      speechArtifact: await this.findTranscriptArtifact(media.id),
      selectedLanguage: media.selectedLanguage,
      detectedLanguage: media.detectedLanguage,
      transcriptionConfidence: media.transcriptionConfidence,
      uploadedAt: media.uploadedAt,
    };
  }

  async retryTranscription(incidentId: string, mediaId: string, actor?: JwtPayload) {
    if (actor?.typ !== "admin") throw new ForbiddenException("Admin access required");
    await this.getIncidentVoiceAttachment(incidentId, mediaId, actor);
    await this.transcription.enqueueIncidentMediaTranscription(mediaId);
    return { status: "queued", mediaId };
  }

  async getTranscript(incidentId: string, mediaId: string, actor?: JwtPayload, targetLocale?: string) {
    const media = await this.getIncidentVoiceAttachment(incidentId, mediaId, actor);
    const artifact = await this.findTranscriptArtifact(media.id);
    const target = this.resolveTargetLocale(targetLocale);
    const translation = target && artifact?.status === "COMPLETED"
      ? await this.findOrQueueTranslation(artifact.id, target)
      : null;

    return {
      mediaId: media.id,
      sourceContentId: media.id,
      original: {
        provenance: "ORIGINAL",
        mediaType: media.mediaType,
        contentType: media.contentType,
        objectKey: media.objectKey,
      },
      transcript: artifact
        ? {
            speechArtifactId: artifact.id,
            provenance: artifact.provenance,
            status: artifact.status,
            sourceLocale: artifact.sourceLocale,
            detectedLocale: artifact.detectedLocale,
            languageConfidence: artifact.languageConfidence,
            confidence: artifact.confidence,
            generatedAt: artifact.generatedAt,
            text: artifact.content,
          }
        : {
            speechArtifactId: null,
            provenance: "TRANSCRIPT",
            status: media.transcriptionStatus ?? "PENDING",
            sourceLocale: media.selectedLanguage,
            detectedLocale: media.detectedLanguage,
            languageConfidence: media.languageDetectionConfidence,
            confidence: media.transcriptionConfidence,
            generatedAt: media.transcriptionProcessedAt,
            text: media.transcript,
          },
      translation,
    };
  }

  async requestTranslation(incidentId: string, mediaId: string, targetLocale: string | undefined, actor?: JwtPayload) {
    await this.getIncidentVoiceAttachment(incidentId, mediaId, actor);
    const target = this.resolveTargetLocale(targetLocale);
    if (!target) throw new BadRequestException("targetLocale is required");
    const result = await this.transcription.requestTranslationForIncidentMedia(mediaId, target);
    if (result.status === "transcript_unavailable") {
      throw new BadRequestException("Transcript is not available yet");
    }
    return {
      mediaId,
      targetLocale: target,
      status: result.status,
      translation: "translation" in result ? this.serializeTranslation(result.translation) : null,
    };
  }

  async correctTranscript(
    incidentId: string,
    mediaId: string,
    transcript: string,
    actor?: JwtPayload,
  ) {
    if (actor?.typ !== "admin") throw new ForbiddenException("Admin access required");
    const trimmed = transcript.trim();
    if (trimmed.length < 1) throw new BadRequestException("Transcript cannot be empty");

    const media = await this.getIncidentVoiceAttachment(incidentId, mediaId, actor);
    const updated = await this.prisma.incidentMedia.update({
      where: { id: media.id },
      data: {
        transcript: trimmed,
        transcriptionStatus: media.transcriptionStatus === "Failed" ? "Completed" : media.transcriptionStatus,
        transcriptionProcessedAt: new Date(),
      },
    });

    await this.audit.record({
      actor,
      action: "voice.transcript_corrected",
      entityType: "incident_media",
      entityId: mediaId,
      reason: "Manual transcript correction",
      metadata: { incidentId },
    });

    return updated;
  }

  validateVoiceMetadata(input: {
    durationSeconds?: number;
    selectedLanguage?: string;
    clientAttachmentId?: string;
  }) {
    if (input.durationSeconds !== undefined) {
      if (!Number.isInteger(input.durationSeconds) || input.durationSeconds <= 0 || input.durationSeconds > 300) {
        throw new BadRequestException("Voice duration must be between 1 and 300 seconds");
      }
    }
    if (input.selectedLanguage && !isSupportedVoiceLanguage(input.selectedLanguage)) {
      throw new BadRequestException("Unsupported voice language");
    }
  }

  private async findTranscriptArtifact(mediaId: string) {
    return (this.prisma as any).speechArtifact.findUnique({
      where: { sourceType_sourceId_provenance: { sourceType: "incident_media", sourceId: mediaId, provenance: "TRANSCRIPT" } },
      include: { translations: true },
    });
  }

  private async findOrQueueTranslation(artifactId: string, targetLocale: string) {
    const existing = await (this.prisma as any).speechTranslation.findUnique({
      where: { speechArtifactId_targetLocale: { speechArtifactId: artifactId, targetLocale } },
    });
    if (existing) return this.serializeTranslation(existing);
    const result = await this.transcription.enqueueTranslation(artifactId, targetLocale);
    return "translation" in result ? this.serializeTranslation(result.translation) : null;
  }

  private resolveTargetLocale(targetLocale: string | undefined) {
    if (!targetLocale) return null;
    const normalized = normalizePreferredLocale(targetLocale);
    if (!isEnabledPreferredLocale(normalized)) {
      throw new BadRequestException("Unsupported targetLocale");
    }
    return effectivePreferredLocale(normalized);
  }

  private serializeTranslation(translation: any) {
    if (!translation) return null;
    return {
      translationId: translation.id,
      speechArtifactId: translation.speechArtifactId,
      provenance: "TRANSLATION",
      targetLocale: translation.targetLocale,
      sourceLocale: translation.sourceLocale,
      status: translation.status,
      confidence: translation.confidence,
      generatedAt: translation.generatedAt,
      text: translation.translatedText,
    };
  }
}
