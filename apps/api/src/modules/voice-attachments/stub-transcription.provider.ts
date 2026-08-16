import { Injectable } from "@nestjs/common";
import type { TranscriptionInput, TranscriptionResult, VoiceTranscriptionProvider } from "./transcription-provider.interface";

@Injectable()
export class StubTranscriptionProvider implements VoiceTranscriptionProvider {
  readonly name = "stub";

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const started = Date.now();
    const language = input.selectedLanguage && input.selectedLanguage !== "auto" ? input.selectedLanguage : "en";
    return {
      transcript: "[Automated transcript pending provider integration — verify against original audio.]",
      detectedLanguage: language,
      languageDetectionConfidence: 0.5,
      transcriptionConfidence: 0.4,
      providerReference: `stub-${input.attachmentId}`,
      model: "stub-transcription",
      processingDurationMs: Date.now() - started,
      lowConfidence: true,
    };
  }
}
