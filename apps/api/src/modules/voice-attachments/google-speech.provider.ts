import { Injectable, Optional } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { createStorageDownloadUrl } from "../../common/storage/s3-presign";
import { resolveSpeechRuntimeConfig } from "./speech-runtime.config";
import { SpeechProviderError, UnsupportedSpeechLanguageError } from "./speech-provider.errors";
import type { TranscriptionInput, TranscriptionResult, VoiceTranscriptionProvider } from "./transcription-provider.interface";
import type { SpeechTranslationProvider, TranslationInput, TranslationResult } from "./translation-provider.interface";

const GOOGLE_TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";

const GOOGLE_STT_LANGUAGE_CODES: Record<string, string> = {
  en: "en-US",
  ha: "ha-NG",
  yo: "yo-NG",
  ig: "ig-NG",
};

const GOOGLE_TRANSLATION_LANGUAGE_CODES: Record<string, string> = {
  en: "en",
  ha: "ha",
  yo: "yo",
  ig: "ig",
};

function normalizeGoogleError(status: number): string {
  if (status === 401 || status === 403) return "PROVIDER_AUTH_FAILED";
  if (status === 408 || status === 504) return "PROVIDER_TIMEOUT";
  if (status === 429) return "PROVIDER_RATE_LIMIT";
  return "PROVIDER_REQUEST_FAILED";
}

function normalizeSelectedLanguage(locale: string | null | undefined) {
  return String(locale ?? "auto").trim().toLowerCase();
}

async function readEvidenceAudioBase64(input: TranscriptionInput) {
  const signed = await createStorageDownloadUrl(input.storageKey, 300);
  const response = await fetch(signed.url);
  if (!response.ok) {
    throw new SpeechProviderError("AUDIO_FETCH_FAILED", `Unable to fetch evidence audio: ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return bytes.toString("base64");
}

@Injectable()
export class GoogleTranscriptionProvider implements VoiceTranscriptionProvider {
  readonly name = "google";

  constructor(@Optional() private readonly config?: ConfigService) {}

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const runtime = resolveSpeechRuntimeConfig(this.config);
    if (!runtime.googleAccessToken || !runtime.googleProjectId) {
      throw new SpeechProviderError("PROVIDER_AUTH_FAILED", "Google speech credentials are not configured");
    }

    const selected = normalizeSelectedLanguage(input.selectedLanguage);
    if (selected !== "auto" && !GOOGLE_STT_LANGUAGE_CODES[selected]) {
      throw new UnsupportedSpeechLanguageError(selected, "google-stt");
    }

    const languageCodes =
      selected === "auto" ? Object.values(GOOGLE_STT_LANGUAGE_CODES) : [GOOGLE_STT_LANGUAGE_CODES[selected]];
    const started = Date.now();
    const url =
      `https://speech.googleapis.com/v2/projects/${encodeURIComponent(runtime.googleProjectId)}` +
      `/locations/${encodeURIComponent(runtime.googleLocation)}/recognizers/_:recognize`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runtime.googleAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        config: {
          model: runtime.googleSttModel,
          languageCodes,
          autoDecodingConfig: {},
          features: { enableWordConfidence: true },
        },
        content: await readEvidenceAudioBase64(input),
      }),
    });
    if (!response.ok) {
      throw new SpeechProviderError(normalizeGoogleError(response.status), `Google STT failed: ${response.status}`);
    }

    const body = (await response.json()) as {
      results?: Array<{
        languageCode?: string;
        alternatives?: Array<{ transcript?: string; confidence?: number }>;
      }>;
    };
    const transcript = (body.results ?? [])
      .map((result) => result.alternatives?.[0]?.transcript ?? "")
      .filter(Boolean)
      .join(" ")
      .trim();
    if (!transcript) {
      throw new SpeechProviderError("PROVIDER_EMPTY_TRANSCRIPT", "Google STT returned empty text");
    }
    const firstResult = body.results?.find((result) => result.alternatives?.[0]);
    const confidence = firstResult?.alternatives?.[0]?.confidence;

    return {
      transcript,
      detectedLanguage: firstResult?.languageCode,
      transcriptionConfidence: typeof confidence === "number" ? confidence : undefined,
      model: runtime.googleSttModel,
      processingDurationMs: Date.now() - started,
    };
  }
}

@Injectable()
export class GoogleTranslationProvider implements SpeechTranslationProvider {
  readonly name = "google";

  constructor(@Optional() private readonly config?: ConfigService) {}

  async translate(input: TranslationInput): Promise<TranslationResult> {
    const runtime = resolveSpeechRuntimeConfig(this.config);
    if (!runtime.googleAccessToken || !runtime.googleProjectId) {
      throw new SpeechProviderError("PROVIDER_AUTH_FAILED", "Google translation credentials are not configured");
    }
    const targetCode = GOOGLE_TRANSLATION_LANGUAGE_CODES[input.targetLocale];
    if (!targetCode) throw new UnsupportedSpeechLanguageError(input.targetLocale, "google-translation");

    const started = Date.now();
    const params = new URLSearchParams({
      q: input.text,
      target: targetCode,
      format: "text",
      model: runtime.googleTranslationModel,
    });
    if (input.sourceLocale && GOOGLE_TRANSLATION_LANGUAGE_CODES[input.sourceLocale]) {
      params.set("source", GOOGLE_TRANSLATION_LANGUAGE_CODES[input.sourceLocale]);
    }

    const response = await fetch(GOOGLE_TRANSLATE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runtime.googleAccessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    if (!response.ok) {
      throw new SpeechProviderError(normalizeGoogleError(response.status), `Google translation failed: ${response.status}`);
    }
    const body = (await response.json()) as {
      data?: { translations?: Array<{ translatedText?: string; detectedSourceLanguage?: string }> };
    };
    const translatedText = body.data?.translations?.[0]?.translatedText?.trim() ?? "";
    if (!translatedText) {
      throw new SpeechProviderError("PROVIDER_EMPTY_TRANSLATION", "Google translation returned empty text");
    }
    return {
      translatedText,
      model: runtime.googleTranslationModel,
      processingDurationMs: Date.now() - started,
    };
  }
}
