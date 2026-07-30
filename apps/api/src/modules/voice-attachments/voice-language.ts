export const SUPPORTED_VOICE_LANGUAGES = [
  { code: "auto", label: "Automatic detection" },
  { code: "en", label: "English" },
  { code: "pcm", label: "Nigerian Pidgin" },
  { code: "ha", label: "Hausa" },
  { code: "yo", label: "Yoruba" },
  { code: "ig", label: "Igbo" },
  { code: "fr", label: "French" },
  { code: "sw", label: "Swahili" },
] as const;

export type VoiceLanguageCode = (typeof SUPPORTED_VOICE_LANGUAGES)[number]["code"];

export function isSupportedVoiceLanguage(code: string | undefined | null): code is VoiceLanguageCode {
  if (!code) return false;
  return SUPPORTED_VOICE_LANGUAGES.some((entry) => entry.code === code);
}

export const VOICE_MAX_DURATION_SECONDS = 300;
export const VOICE_MAX_BYTES = 25 * 1024 * 1024;

export const VOICE_LANGUAGE_LABELS: Record<VoiceLanguageCode, string> = {
  auto: "Automatic detection",
  en: "English",
  pcm: "Nigerian Pidgin",
  ha: "Hausa",
  yo: "Yoruba",
  ig: "Igbo",
  fr: "French",
  sw: "Swahili",
};

/** Languages with real Whisper transcription in Stage 3. */
export const STAGE3_TRANSCRIPTION_LANGUAGE_CODES = ["auto", "en", "pcm"] as const;
export type Stage3TranscriptionLanguageCode = (typeof STAGE3_TRANSCRIPTION_LANGUAGE_CODES)[number];

/** Languages added in Stage 4 (Whisper ISO hints + detection normalization). */
export const STAGE4_TRANSCRIPTION_LANGUAGE_CODES = ["ha", "yo", "ig", "fr", "sw"] as const;
export type Stage4TranscriptionLanguageCode = (typeof STAGE4_TRANSCRIPTION_LANGUAGE_CODES)[number];

export const WHISPER_TRANSCRIPTION_LANGUAGE_CODES = [
  ...STAGE3_TRANSCRIPTION_LANGUAGE_CODES,
  ...STAGE4_TRANSCRIPTION_LANGUAGE_CODES,
] as const;
export type WhisperTranscriptionLanguageCode = (typeof WHISPER_TRANSCRIPTION_LANGUAGE_CODES)[number];

const WHISPER_ISO_HINTS: Partial<Record<VoiceLanguageCode, string>> = {
  en: "en",
  ha: "ha",
  yo: "yo",
  ig: "ig",
  fr: "fr",
  sw: "sw",
};

const WHISPER_DETECTED_LANGUAGE_MAP: Record<string, VoiceLanguageCode> = {
  en: "en",
  english: "en",
  ha: "ha",
  hausa: "ha",
  yo: "yo",
  yoruba: "yo",
  ig: "ig",
  igbo: "ig",
  fr: "fr",
  french: "fr",
  sw: "sw",
  swahili: "sw",
};

export function isStage3TranscriptionLanguage(code: string | undefined | null): code is Stage3TranscriptionLanguageCode {
  if (!code) return true;
  return STAGE3_TRANSCRIPTION_LANGUAGE_CODES.includes(code as Stage3TranscriptionLanguageCode);
}

export function isStage4TranscriptionLanguage(code: string | undefined | null): code is Stage4TranscriptionLanguageCode {
  if (!code) return false;
  return STAGE4_TRANSCRIPTION_LANGUAGE_CODES.includes(code as Stage4TranscriptionLanguageCode);
}

export function isWhisperTranscriptionLanguage(code: string | undefined | null): code is WhisperTranscriptionLanguageCode {
  if (!code) return true;
  return WHISPER_TRANSCRIPTION_LANGUAGE_CODES.includes(code as WhisperTranscriptionLanguageCode);
}

export function formatVoiceLanguageLabel(code: string | undefined | null): string {
  if (!code) return "—";
  if (isSupportedVoiceLanguage(code)) return VOICE_LANGUAGE_LABELS[code];
  return code;
}

/** Maps app language codes to Whisper ISO hints. Pidgin and auto-detect omit the hint. */
export function resolveWhisperLanguageHint(selectedLanguage?: string | null): string | undefined {
  if (!selectedLanguage || selectedLanguage === "auto" || selectedLanguage === "pcm") {
    return undefined;
  }
  if (!isSupportedVoiceLanguage(selectedLanguage)) return undefined;
  return WHISPER_ISO_HINTS[selectedLanguage];
}

/** Normalizes Whisper verbose_json language labels to THE EYE codes without inventing Pidgin. */
export function normalizeWhisperDetectedLanguage(whisperLanguage?: string | null): VoiceLanguageCode | undefined {
  if (!whisperLanguage) return undefined;
  const key = whisperLanguage.trim().toLowerCase();
  return WHISPER_DETECTED_LANGUAGE_MAP[key] ?? (key.length <= 3 ? (key as VoiceLanguageCode) : undefined);
}

export function computeSegmentTranscriptionConfidence(
  segments: Array<{ avg_logprob?: number | null }> | undefined,
): number {
  if (!segments?.length) return 0;
  const logprobs = segments.map((segment) => segment.avg_logprob).filter((value): value is number => typeof value === "number");
  if (!logprobs.length) return 0;
  const averageLogprob = logprobs.reduce((sum, value) => sum + value, 0) / logprobs.length;
  return Math.min(1, Math.max(0, Math.exp(averageLogprob)));
}

export function parseTranscriptionConfidenceThreshold(): number {
  const raw = process.env.TRANSCRIPTION_CONFIDENCE_THRESHOLD?.trim();
  const parsed = raw ? Number(raw) : 0.55;
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) return 0.55;
  return parsed;
}

export function evaluateTranscriptionQuality(params: {
  selectedLanguage?: string | null;
  detectedLanguage?: VoiceLanguageCode;
  transcriptionConfidence: number;
  transcript: string;
  threshold?: number;
}): {
  lowConfidence: boolean;
  languageDetectionConfidence: number;
} {
  const threshold = params.threshold ?? parseTranscriptionConfidenceThreshold();
  const transcript = params.transcript.trim();
  if (!transcript) {
    return { lowConfidence: true, languageDetectionConfidence: 0 };
  }

  const selected = params.selectedLanguage && params.selectedLanguage !== "auto" ? params.selectedLanguage : undefined;
  const detected = params.detectedLanguage;

  if (!selected) {
    const languageDetectionConfidence = detected ? Math.min(1, params.transcriptionConfidence + 0.1) : 0.5;
    return {
      lowConfidence: params.transcriptionConfidence < threshold,
      languageDetectionConfidence,
    };
  }

  if (selected === "pcm") {
    // Whisper has no Pidgin ISO code — English detection may still be valid Pidgin speech.
    const languageDetectionConfidence =
      detected === "en" ? Math.min(0.75, params.transcriptionConfidence) : params.transcriptionConfidence;
    return {
      lowConfidence: params.transcriptionConfidence < threshold,
      languageDetectionConfidence,
    };
  }

  const languageMatches = !!detected && detected === selected;
  const languageDetectionConfidence = languageMatches
    ? Math.min(1, params.transcriptionConfidence + 0.15)
    : Math.max(0.2, params.transcriptionConfidence - 0.2);

  return {
    lowConfidence: params.transcriptionConfidence < threshold || (!!detected && !languageMatches),
    languageDetectionConfidence,
  };
}
