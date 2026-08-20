export type SpeechSynthesisInput = {
  translationId: string;
  text: string;
  locale: string;
  voice?: string;
};

export type SpeechSynthesisResult = {
  audio: Uint8Array;
  contentType: string;
  voice?: string;
  providerReference?: string;
  model?: string;
  processingDurationMs?: number;
};

export interface SpeechSynthesisProvider {
  readonly name: string;
  synthesize(input: SpeechSynthesisInput): Promise<SpeechSynthesisResult>;
}
