export type TranslationInput = {
  speechArtifactId: string;
  sourceContentId: string;
  sourceLocale?: string | null;
  targetLocale: string;
  text: string;
};

export type TranslationResult = {
  translatedText: string;
  confidence?: number;
  providerReference?: string;
  model?: string;
  processingDurationMs?: number;
};

export interface SpeechTranslationProvider {
  readonly name: string;
  translate(input: TranslationInput): Promise<TranslationResult>;
}
