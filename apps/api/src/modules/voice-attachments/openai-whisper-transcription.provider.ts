import { Injectable, Logger } from "@nestjs/common";
import { createS3PresignedGetUrl } from "../../common/storage/s3-presign";
import type { TranscriptionInput, TranscriptionResult, VoiceTranscriptionProvider } from "./transcription-provider.interface";
import {
  computeSegmentTranscriptionConfidence,
  evaluateTranscriptionQuality,
  normalizeWhisperDetectedLanguage,
  parseTranscriptionConfidenceThreshold,
  resolveWhisperLanguageHint,
} from "./voice-language";

type WhisperVerboseSegment = {
  avg_logprob?: number | null;
};

type WhisperVerboseResponse = {
  text?: string;
  language?: string;
  segments?: WhisperVerboseSegment[];
};

@Injectable()
export class OpenAiWhisperTranscriptionProvider implements VoiceTranscriptionProvider {
  readonly name = "openai-whisper";
  private readonly logger = new Logger(OpenAiWhisperTranscriptionProvider.name);

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const started = Date.now();
    const signedUrl = createS3PresignedGetUrl(input.storageKey, 600);
    const audioResponse = await fetch(signedUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio object (${audioResponse.status})`);
    }

    const buffer = Buffer.from(await audioResponse.arrayBuffer());
    const extension = input.contentType.includes("webm") ? "webm" : "m4a";
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: input.contentType }), `audio.${extension}`);
    form.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || "whisper-1");
    form.append("response_format", "verbose_json");

    const languageHint = resolveWhisperLanguageHint(input.selectedLanguage);
    if (languageHint) {
      form.append("language", languageHint);
    }

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI transcription failed (${response.status}): ${body.slice(0, 240)}`);
    }

    const payload = (await response.json()) as WhisperVerboseResponse;
    const transcript = payload.text?.trim() ?? "";
    const detectedLanguage = normalizeWhisperDetectedLanguage(payload.language);
    const transcriptionConfidence = computeSegmentTranscriptionConfidence(payload.segments);
    const threshold = parseTranscriptionConfidenceThreshold();
    const quality = evaluateTranscriptionQuality({
      selectedLanguage: input.selectedLanguage,
      detectedLanguage,
      transcriptionConfidence,
      transcript,
      threshold,
    });

    if (input.selectedLanguage === "pcm" && detectedLanguage === "en") {
      this.logger.debug(
        `Whisper detected English for Pidgin-selected attachment ${input.attachmentId}; keeping user-selected pcm`,
      );
    }

    return {
      transcript,
      detectedLanguage,
      languageDetectionConfidence: quality.languageDetectionConfidence,
      transcriptionConfidence,
      providerReference: `whisper-${input.attachmentId}`,
      processingDurationMs: Date.now() - started,
      lowConfidence: quality.lowConfidence,
    };
  }
}
