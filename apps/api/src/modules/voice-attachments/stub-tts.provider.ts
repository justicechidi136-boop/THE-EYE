import { Injectable } from "@nestjs/common";
import type {
  SpeechSynthesisInput,
  SpeechSynthesisProvider,
  SpeechSynthesisResult,
} from "./tts-provider.interface";

@Injectable()
export class StubTtsProvider implements SpeechSynthesisProvider {
  readonly name = "stub";

  async synthesize(input: SpeechSynthesisInput): Promise<SpeechSynthesisResult> {
    return {
      audio: new TextEncoder().encode(`stub-audio:${input.locale}:${input.text}`),
      contentType: "audio/mpeg",
      voice: input.voice ?? "stub",
      model: "stub-tts",
      processingDurationMs: 0,
    };
  }
}
