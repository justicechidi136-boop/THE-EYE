export type TranscriptionInput = {
  attachmentId: string;
  storageKey: string;
  contentType: string;
  selectedLanguage?: string | null;
  durationSeconds?: number | null;
};

export type TranscriptionResult = {
  transcript: string;
  detectedLanguage?: string;
  languageDetectionConfidence?: number;
  transcriptionConfidence?: number;
  providerReference?: string;
  processingDurationMs?: number;
  lowConfidence?: boolean;
};

export interface VoiceTranscriptionProvider {
  readonly name: string;
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}
