import { Injectable, Logger } from "@nestjs/common";
import { OpenAiWhisperTranscriptionProvider } from "./openai-whisper-transcription.provider";
import { StubTranscriptionProvider } from "./stub-transcription.provider";
import type { VoiceTranscriptionProvider } from "./transcription-provider.interface";

export type TranscriptionProviderName = "stub" | "openai-whisper";

@Injectable()
export class TranscriptionProviderFactory {
  private readonly logger = new Logger(TranscriptionProviderFactory.name);
  private readonly resolved: VoiceTranscriptionProvider;

  constructor(
    private readonly stubProvider: StubTranscriptionProvider,
    private readonly openAiProvider: OpenAiWhisperTranscriptionProvider,
  ) {
    this.resolved = this.resolveProvider();
    this.logger.log(`Voice transcription provider: ${this.resolved.name}`);
  }

  getProvider(): VoiceTranscriptionProvider {
    return this.resolved;
  }

  private resolveProvider(): VoiceTranscriptionProvider {
    const configured = process.env.TRANSCRIPTION_PROVIDER?.trim().toLowerCase();
    const openAiKey = process.env.OPENAI_API_KEY?.trim();

    if (configured === "stub") {
      return this.stubProvider;
    }

    if (configured === "openai" || configured === "openai-whisper") {
      if (!openAiKey) {
        this.logger.warn("TRANSCRIPTION_PROVIDER=openai but OPENAI_API_KEY is missing; falling back to stub");
        return this.stubProvider;
      }
      return this.openAiProvider;
    }

    if (openAiKey) {
      return this.openAiProvider;
    }

    return this.stubProvider;
  }
}
