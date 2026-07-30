import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { JwtPayload } from "../../common/auth/jwt";
import { createS3PresignedGetUrl } from "../../common/storage/s3-presign";
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

    return {
      mediaId: media.id,
      signedUrl: createS3PresignedGetUrl(media.objectKey, 300),
      expiresInSeconds: 300,
      durationSeconds: media.durationSeconds,
      transcriptionStatus: media.transcriptionStatus,
      transcript: media.transcript,
      translatedTranscript: media.translatedTranscript,
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
}
