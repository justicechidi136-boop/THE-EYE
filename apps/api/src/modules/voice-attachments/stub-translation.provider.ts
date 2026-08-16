import { Injectable } from "@nestjs/common";
import type { SpeechTranslationProvider, TranslationInput, TranslationResult } from "./translation-provider.interface";

@Injectable()
export class StubTranslationProvider implements SpeechTranslationProvider {
  readonly name = "stub";

  async translate(input: TranslationInput): Promise<TranslationResult> {
    return {
      translatedText: `[${input.targetLocale}] ${input.text}`,
      confidence: 0.4,
      providerReference: `stub-${input.speechArtifactId}-${input.targetLocale}`,
      model: "stub-translation",
      processingDurationMs: 0,
    };
  }
}
