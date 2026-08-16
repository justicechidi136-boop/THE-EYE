import {
  DEFAULT_PREFERRED_LOCALE,
  PreferredLocale,
  effectivePreferredLocale,
  isEnabledPreferredLocale,
  normalizePreferredLocale,
} from "./language-region";

export const LANGUAGE_CONTENT_PROVENANCE = [
  "ORIGINAL",
  "TRANSCRIPT",
  "TRANSLATION",
  "SYNTHESIZED_SPEECH",
] as const;

export type LanguageContentProvenance = (typeof LANGUAGE_CONTENT_PROVENANCE)[number];

export const LANGUAGE_PROCESSING_STATUS = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "UNSUPPORTED",
] as const;

export type LanguageProcessingStatus = (typeof LANGUAGE_PROCESSING_STATUS)[number];

export const TTS_PURPOSES = [
  "danger_alert",
  "notification",
  "message",
  "accessibility",
  "general",
] as const;

export type TtsPurpose = (typeof TTS_PURPOSES)[number];

export type LanguageMetadata = {
  sourceLocale?: PreferredLocale;
  targetLocale?: PreferredLocale;
  preferredLocale?: PreferredLocale;
  detectedLocale?: PreferredLocale;
  languageConfidence?: number;
  fallbackLocale?: PreferredLocale;
};

export type GeneratedContentMetadata = {
  provider?: string;
  model?: string;
  generatedAt?: string;
  sourceContentId: string;
  sourceHash?: string;
  confidence?: number;
  status: LanguageProcessingStatus;
};

export type OriginalContentReference = {
  contentId: string;
  provenance: Extract<LanguageContentProvenance, "ORIGINAL">;
  locale?: PreferredLocale;
  hash?: string;
};

export type TranscriptionContract = {
  contentId: string;
  provenance: Extract<LanguageContentProvenance, "TRANSCRIPT">;
  language: LanguageMetadata;
  generated: GeneratedContentMetadata;
  transcriptText?: string;
};

export type TranslationIdentity = {
  sourceContentId: string;
  sourceLocale: PreferredLocale;
  targetLocale: PreferredLocale;
};

export type TranslationContract = TranslationIdentity & {
  contentId: string;
  provenance: Extract<LanguageContentProvenance, "TRANSLATION">;
  generated: GeneratedContentMetadata;
  translatedText?: string;
};

export type SynthesizedSpeechContract = {
  contentId: string;
  provenance: Extract<LanguageContentProvenance, "SYNTHESIZED_SPEECH">;
  language: LanguageMetadata;
  generated: GeneratedContentMetadata;
  audioUrl?: string;
};

export type TtsPriority = "low" | "normal" | "high" | "critical";

export type TtsRequestContract = {
  text: string;
  locale: PreferredLocale;
  purpose: TtsPurpose;
  priority?: TtsPriority;
  contentId?: string;
};

export type NotificationLocalizationContract = {
  templateKey: string;
  recipientPreferredLocale?: PreferredLocale;
  fallbackLocale?: PreferredLocale;
  parameters?: Record<string, string | number | boolean | null>;
  originalContentReference?: OriginalContentReference;
};

export const languageAiContract = {
  contentProvenance: LANGUAGE_CONTENT_PROVENANCE,
  processingStatus: LANGUAGE_PROCESSING_STATUS,
  ttsPurposes: TTS_PURPOSES,
  fallbackOrder: ["recipient preferredLocale", "supported effective locale", DEFAULT_PREFERRED_LOCALE],
} as const;

export function isLanguageContentProvenance(value: string | null | undefined): value is LanguageContentProvenance {
  return LANGUAGE_CONTENT_PROVENANCE.includes(value as LanguageContentProvenance);
}

export function isLanguageProcessingStatus(value: string | null | undefined): value is LanguageProcessingStatus {
  return LANGUAGE_PROCESSING_STATUS.includes(value as LanguageProcessingStatus);
}

export function isTtsPurpose(value: string | null | undefined): value is TtsPurpose {
  return TTS_PURPOSES.includes(value as TtsPurpose);
}

export function resolveLanguageMetadata(input: {
  sourceLocale?: string | null;
  targetLocale?: string | null;
  preferredLocale?: string | null;
  detectedLocale?: string | null;
  fallbackLocale?: string | null;
  languageConfidence?: number | null;
}): LanguageMetadata {
  const metadata: LanguageMetadata = {};
  const sourceLocale = toPreferredLocale(input.sourceLocale);
  const targetLocale = toPreferredLocale(input.targetLocale);
  const preferredLocale = toPreferredLocale(input.preferredLocale);
  const detectedLocale = toPreferredLocale(input.detectedLocale);
  const fallbackLocale = effectivePreferredLocale(input.fallbackLocale);

  if (sourceLocale) metadata.sourceLocale = sourceLocale;
  if (targetLocale) metadata.targetLocale = targetLocale;
  if (preferredLocale) metadata.preferredLocale = preferredLocale;
  if (detectedLocale) metadata.detectedLocale = detectedLocale;
  if (typeof input.languageConfidence === "number") metadata.languageConfidence = input.languageConfidence;
  metadata.fallbackLocale = fallbackLocale;

  return metadata;
}

export function resolveRecipientOutputLocale(recipientPreferredLocale: string | null | undefined): PreferredLocale {
  return effectivePreferredLocale(recipientPreferredLocale);
}

export function createTranslationIdentity(input: {
  sourceContentId: string;
  sourceLocale: string;
  targetLocale: string;
}): TranslationIdentity {
  const sourceLocale = requirePreferredLocale(input.sourceLocale, "sourceLocale");
  const targetLocale = requirePreferredLocale(input.targetLocale, "targetLocale");

  return {
    sourceContentId: input.sourceContentId,
    sourceLocale,
    targetLocale,
  };
}

export function preservesOriginalProvenance(
  original: OriginalContentReference,
  generated: GeneratedContentMetadata,
): boolean {
  return original.provenance === "ORIGINAL" && generated.sourceContentId === original.contentId;
}

function toPreferredLocale(value: string | null | undefined): PreferredLocale | undefined {
  const normalized = normalizePreferredLocale(value);
  return isEnabledPreferredLocale(normalized) ? normalized : undefined;
}

function requirePreferredLocale(value: string, field: "sourceLocale" | "targetLocale"): PreferredLocale {
  const locale = toPreferredLocale(value);
  if (!locale) {
    throw new Error(`Unsupported ${field}`);
  }
  return locale;
}
