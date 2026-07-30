import { Injectable, Logger } from "@nestjs/common";
import type { VoiceModerationStatus } from "@prisma/client";

export type VoiceModerationResult = {
  status: VoiceModerationStatus;
  reason?: string;
  providerReference?: string;
};

const BLOCKLIST_PATTERNS = [
  /\b(kill yourself|kys)\b/i,
  /\b(bomb threat hoax|fake emergency spam)\b/i,
];

@Injectable()
export class VoiceModerationProvider {
  readonly name = "voice-moderation";
  private readonly logger = new Logger(VoiceModerationProvider.name);

  async moderateTranscript(transcript: string, attachmentId: string): Promise<VoiceModerationResult> {
    const trimmed = transcript.trim();
    if (!trimmed) {
      return { status: "Flagged", reason: "empty_transcript", providerReference: `moderation-${attachmentId}` };
    }

    for (const pattern of BLOCKLIST_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          status: "Rejected",
          reason: "blocked_phrase",
          providerReference: `moderation-${attachmentId}`,
        };
      }
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return { status: "Approved", providerReference: `moderation-stub-${attachmentId}` };
    }

    try {
      const response = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODERATION_MODEL?.trim() || "omni-moderation-latest",
          input: trimmed,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.warn(`OpenAI moderation failed (${response.status}): ${body.slice(0, 160)}`);
        return { status: "Flagged", reason: "moderation_provider_error", providerReference: `moderation-${attachmentId}` };
      }

      const payload = (await response.json()) as {
        results?: Array<{
          flagged?: boolean;
          categories?: Record<string, boolean>;
        }>;
      };
      const result = payload.results?.[0];
      if (!result) {
        return { status: "Flagged", reason: "moderation_empty_result", providerReference: `moderation-${attachmentId}` };
      }

      if (!result.flagged) {
        return { status: "Approved", providerReference: `openai-moderation-${attachmentId}` };
      }

      const severe =
        result.categories?.["violence"] ||
        result.categories?.["violence/graphic"] ||
        result.categories?.["sexual/minors"] ||
        result.categories?.["self-harm"];

      return {
        status: severe ? "Rejected" : "Flagged",
        reason: "openai_moderation_flagged",
        providerReference: `openai-moderation-${attachmentId}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Voice moderation failed for ${attachmentId}: ${message}`);
      return { status: "Flagged", reason: "moderation_provider_error", providerReference: `moderation-${attachmentId}` };
    }
  }
}
