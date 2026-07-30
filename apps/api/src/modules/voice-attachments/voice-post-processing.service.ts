import { Injectable, Logger } from "@nestjs/common";
import type { VoiceModerationStatus } from "@prisma/client";
import { MetricsService } from "../../common/metrics/metrics.service";
import { VoiceModerationProvider } from "./voice-moderation.provider";
import { VoiceTranslationProvider } from "./voice-translation.provider";

export type VoicePostProcessingInput = {
  attachmentId: string;
  resourceType: "incident_media" | "community_post_media" | "community_comment_media";
  transcript: string;
  selectedLanguage?: string | null;
  detectedLanguage?: string | null;
};

export type VoicePostProcessingResult = {
  translatedTranscript?: string | null;
  moderationStatus: VoiceModerationStatus;
  moderationReason?: string;
};

@Injectable()
export class VoicePostProcessingService {
  private readonly logger = new Logger(VoicePostProcessingService.name);

  constructor(
    private readonly translation: VoiceTranslationProvider,
    private readonly moderation: VoiceModerationProvider,
    private readonly metrics: MetricsService,
  ) {}

  async process(input: VoicePostProcessingInput): Promise<VoicePostProcessingResult> {
    let translatedTranscript: string | null = null;
    const sourceLanguage = input.detectedLanguage ?? input.selectedLanguage;

    try {
      const translation = await this.translation.translateToEnglish(input.transcript, sourceLanguage);
      if (translation) {
        translatedTranscript = translation.translatedText;
        this.metrics.recordVoiceTranslation("success", sourceLanguage ?? "unknown");
      } else {
        this.metrics.recordVoiceTranslation("skipped", sourceLanguage ?? "unknown");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Voice translation failed for ${input.attachmentId}: ${message}`);
      this.metrics.recordVoiceTranslation("failed", sourceLanguage ?? "unknown");
    }

    const moderation = await this.moderation.moderateTranscript(input.transcript, input.attachmentId);
    this.metrics.recordVoiceModeration(moderation.status, input.resourceType);

    return {
      translatedTranscript,
      moderationStatus: moderation.status,
      moderationReason: moderation.reason,
    };
  }
}
