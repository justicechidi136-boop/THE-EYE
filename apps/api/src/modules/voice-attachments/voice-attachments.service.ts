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

    const synthesis = translation?.translationId
      ? await this.findSynthesis(translation.translationId)
      : null;
    const signed = await createStorageDownloadUrl(media.objectKey, 300);

    return {
      mediaId: media.id,
      sourceContentId: media.id,
      original: {
        provenance: "ORIGINAL",
        mediaType: media.mediaType,
        contentType: media.contentType,
        signedUrl: signed.url,
        expiresInSeconds: signed.expiresInSeconds,
        durationSeconds: media.durationSeconds,
        locale: media.selectedLanguage ?? media.detectedLanguage,
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
      synthesis,
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

  async getBroadcastVoice(
    broadcastId: string,
    mediaId: string,
    actor: JwtPayload,
    targetLocale?: string,
  ) {
    const media = await this.getBroadcastVoiceAttachment(broadcastId, mediaId, actor);
    const artifact = await this.findTranscriptArtifactForSource("broadcast_media", media.id);
    const target = this.resolveTargetLocale(targetLocale);
    const translation = target && artifact?.status === "COMPLETED"
      ? await this.findOrQueueTranslation(artifact.id, target)
      : null;
    const synthesis = translation?.translationId
      ? await this.findSynthesis(translation.translationId)
      : null;
    const signed = await createStorageDownloadUrl(media.objectKey, 300);

    return {
      mediaId: media.id,
      sourceContentId: media.id,
      original: {
        provenance: "ORIGINAL",
        mediaType: media.mediaType,
        signedUrl: signed.url,
        expiresInSeconds: signed.expiresInSeconds,
        durationSeconds: media.durationSeconds,
        locale: media.selectedLanguage ?? media.detectedLanguage,
      },
      transcript: artifact
        ? {
            speechArtifactId: artifact.id,
            provenance: "TRANSCRIPT",
            status: artifact.status,
            sourceLocale: artifact.sourceLocale,
            detectedLocale: artifact.detectedLocale,
            languageConfidence: artifact.languageConfidence,
            confidence: artifact.confidence,
            generatedAt: artifact.generatedAt,
            version: artifact.version ?? 1,
            text: artifact.content,
          }
        : {
            speechArtifactId: null,
            provenance: "TRANSCRIPT",
            status: media.transcriptionStatus ?? "PENDING",
            sourceLocale: media.selectedLanguage,
            detectedLocale: media.detectedLanguage,
            confidence: media.transcriptionConfidence,
            generatedAt: media.transcriptionProcessedAt,
            version: 1,
            text: media.transcript,
          },
      translation,
      synthesis,
    };
  }

  async requestBroadcastTranslation(
    broadcastId: string,
    mediaId: string,
    targetLocale: string | undefined,
    actor: JwtPayload,
  ) {
    await this.getBroadcastVoiceAttachment(broadcastId, mediaId, actor);
    const target = this.resolveTargetLocale(targetLocale);
    if (!target) throw new BadRequestException("targetLocale is required");
    const artifact = await this.findTranscriptArtifactForSource("broadcast_media", mediaId);
    if (!artifact || artifact.status !== "COMPLETED") {
      throw new BadRequestException("Transcript is not available yet");
    }
    const result = await this.transcription.enqueueTranslation(String(artifact.id), target);
    return { mediaId, targetLocale: target, status: result.status };
  }

  async requestIncidentSynthesis(
    incidentId: string,
    mediaId: string,
    targetLocale: string | undefined,
    actor?: JwtPayload,
  ) {
    await this.getIncidentVoiceAttachment(incidentId, mediaId, actor);
    return this.requestSynthesisForSource("incident_media", mediaId, targetLocale);
  }

  async requestBroadcastSynthesis(
    broadcastId: string,
    mediaId: string,
    targetLocale: string | undefined,
    actor: JwtPayload,
  ) {
    await this.getBroadcastVoiceAttachment(broadcastId, mediaId, actor);
    return this.requestSynthesisForSource("broadcast_media", mediaId, targetLocale);
  }

  async getCommunityPostVoice(postId: string, mediaId: string, targetLocale?: string) {
    const media = await this.getCommunityPostVoiceAttachment(postId, mediaId);
    const artifact = await this.findTranscriptArtifactForSource("community_post_media", media.id);
    const target = this.resolveTargetLocale(targetLocale);
    const translation = target && artifact?.status === "COMPLETED"
      ? await this.findOrQueueTranslation(artifact.id, target)
      : null;
    const synthesis = translation?.translationId
      ? await this.findSynthesis(translation.translationId)
      : null;
    const signed = await createStorageDownloadUrl(media.objectKey, 300);
    return {
      mediaId: media.id,
      sourceContentId: media.id,
      original: {
        provenance: "ORIGINAL",
        mediaType: media.mediaType,
        contentType: media.contentType,
        signedUrl: signed.url,
        expiresInSeconds: signed.expiresInSeconds,
        durationSeconds: media.durationSeconds,
        locale: media.selectedLanguage ?? media.detectedLanguage,
      },
      transcript: artifact
        ? {
            speechArtifactId: artifact.id,
            provenance: "TRANSCRIPT",
            status: artifact.status,
            sourceLocale: artifact.sourceLocale,
            detectedLocale: artifact.detectedLocale,
            languageConfidence: artifact.languageConfidence,
            confidence: artifact.confidence,
            generatedAt: artifact.generatedAt,
            version: artifact.version ?? 1,
            text: artifact.content,
          }
        : {
            speechArtifactId: null,
            provenance: "TRANSCRIPT",
            status: media.transcriptionStatus ?? "PENDING",
            sourceLocale: media.selectedLanguage,
            detectedLocale: media.detectedLanguage,
            confidence: media.transcriptionConfidence,
            generatedAt: media.transcriptionProcessedAt,
            version: 1,
            text: media.transcript,
          },
      translation,
      synthesis,
    };
  }

  async requestCommunityPostTranslation(postId: string, mediaId: string, targetLocale?: string) {
    await this.getCommunityPostVoiceAttachment(postId, mediaId);
    const target = this.resolveTargetLocale(targetLocale);
    if (!target) throw new BadRequestException("targetLocale is required");
    const artifact = await this.findTranscriptArtifactForSource("community_post_media", mediaId);
    if (!artifact || artifact.status !== "COMPLETED") {
      throw new BadRequestException("Transcript is not available yet");
    }
    const result = await this.transcription.enqueueTranslation(String(artifact.id), target);
    return { mediaId, targetLocale: target, status: result.status };
  }

  async requestCommunityPostSynthesis(postId: string, mediaId: string, targetLocale?: string) {
    await this.getCommunityPostVoiceAttachment(postId, mediaId);
    return this.requestSynthesisForSource("community_post_media", mediaId, targetLocale);
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
    return this.findTranscriptArtifactForSource("incident_media", mediaId);
  }

  private async findTranscriptArtifactForSource(sourceType: string, sourceId: string) {
    return (this.prisma as any).speechArtifact.findUnique({
      where: { sourceType_sourceId_provenance: { sourceType, sourceId, provenance: "TRANSCRIPT" } },
      include: { translations: true },
    });
  }

  private async getBroadcastVoiceAttachment(broadcastId: string, mediaId: string, actor: JwtPayload) {
    const media = await (this.prisma as any).broadcastMedia.findFirst({
      where: { id: mediaId, broadcastId, deletedAt: null },
      include: { broadcast: { select: { creatorUserId: true, deliveries: { select: { userId: true } } } } },
    });
    if (!media || String(media.mediaType) !== "Audio") throw new NotFoundException("Voice attachment not found");
    if (actor.typ === "user") {
      const delivered = Array.isArray(media.broadcast?.deliveries)
        && media.broadcast.deliveries.some((delivery: { userId?: string }) => delivery.userId === actor.sub);
      const owner = media.broadcast?.creatorUserId === actor.sub;
      const uploader = media.uploaderId === actor.sub;
      if (!owner && !delivered && !uploader) {
        throw new ForbiddenException("You are not allowed to access this voice attachment");
      }
      if (media.sightingId && !owner && !uploader) {
        throw new ForbiddenException("Only the broadcast owner or evidence uploader can access sighting evidence");
      }
    }
    return media;
  }

  private async getCommunityPostVoiceAttachment(postId: string, mediaId: string) {
    const media = await this.prisma.communityPostMedia.findFirst({
      where: { id: mediaId, postId, deletedAt: null },
    });
    if (!media || media.mediaType !== "Audio") throw new NotFoundException("Voice attachment not found");
    return media;
  }

  private async findOrQueueTranslation(artifactId: string, targetLocale: string) {
    const existing = await (this.prisma as any).speechTranslation.findUnique({
      where: { speechArtifactId_targetLocale: { speechArtifactId: artifactId, targetLocale } },
    });
    if (existing) return this.serializeTranslation(existing);
    const result = await this.transcription.enqueueTranslation(artifactId, targetLocale);
    return "translation" in result ? this.serializeTranslation(result.translation) : null;
  }

  private async requestSynthesisForSource(
    sourceType: "incident_media" | "broadcast_media" | "community_post_media",
    mediaId: string,
    targetLocale: string | undefined,
  ) {
    const target = this.resolveTargetLocale(targetLocale);
    if (!target) throw new BadRequestException("targetLocale is required");
    const artifact = await this.findTranscriptArtifactForSource(sourceType, mediaId);
    if (!artifact || artifact.status !== "COMPLETED") {
      throw new BadRequestException("Transcript is not available yet");
    }
    await this.findOrQueueTranslation(artifact.id, target);
    const translation = await (this.prisma as any).speechTranslation.findUnique({
      where: { speechArtifactId_targetLocale: { speechArtifactId: artifact.id, targetLocale: target } },
    });
    if (!translation || translation.status !== "COMPLETED") {
      return { mediaId, targetLocale: target, status: "translation_pending", synthesis: null };
    }
    const result = await this.transcription.enqueueSynthesis(translation.id);
    return {
      mediaId,
      targetLocale: target,
      status: result.status,
      synthesis: "synthesis" in result ? await this.serializeSynthesis(result.synthesis) : null,
    };
  }

  private async findSynthesis(translationId: string) {
    const synthesis = await (this.prisma as any).speechSynthesis.findFirst({
      where: { speechTranslationId: translationId },
      orderBy: { version: "desc" },
    });
    return synthesis ? this.serializeSynthesis(synthesis) : null;
  }

  private async serializeSynthesis(synthesis: any) {
    let signedUrl: string | null = null;
    let expiresInSeconds: number | null = null;
    if (synthesis.status === "COMPLETED" && synthesis.objectKey) {
      const signed = await createStorageDownloadUrl(synthesis.objectKey, 300);
      signedUrl = signed.url;
      expiresInSeconds = signed.expiresInSeconds;
    }
    return {
      synthesisId: synthesis.id,
      speechTranslationId: synthesis.speechTranslationId,
      provenance: "SYNTHESIZED_SPEECH",
      label: "AI translated audio",
      targetLocale: synthesis.targetLocale,
      status: synthesis.status,
      errorCode: synthesis.errorCode,
      version: synthesis.version ?? 1,
      generatedAt: synthesis.generatedAt,
      signedUrl,
      expiresInSeconds,
    };
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
      version: translation.version ?? 1,
      text: translation.translatedText,
    };
  }
}
