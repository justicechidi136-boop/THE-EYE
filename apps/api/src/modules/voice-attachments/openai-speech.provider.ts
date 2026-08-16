import { Injectable, Optional } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { createStorageDownloadUrl } from "../../common/storage/s3-presign";
import { resolveSpeechRuntimeConfig } from "./speech-runtime.config";
import { SpeechProviderError } from "./speech-provider.errors";
import type { TranscriptionInput, TranscriptionResult, VoiceTranscriptionProvider } from "./transcription-provider.interface";
import type { SpeechTranslationProvider, TranslationInput, TranslationResult } from "./translation-provider.interface";

const OPENAI_AUDIO_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

type FetchLike = typeof fetch;

async function fetchEvidenceObject(input: TranscriptionInput, fetchImpl: FetchLike) {
  const signed = await createStorageDownloadUrl(input.storageKey, 300);
  const response = await fetchImpl(signed.url);
  if (!response.ok) {
    throw new SpeechProviderError("AUDIO_FETCH_FAILED", `Unable to fetch evidence audio: ${response.status}`);
  }
  const bytes = await response.arrayBuffer();
  return new Blob([bytes], { type: input.contentType || "application/octet-stream" });
}

function normalizeOpenAiError(status: number): string {
  if (status === 401 || status === 403) return "PROVIDER_AUTH_FAILED";
  if (status === 408 || status === 504) return "PROVIDER_TIMEOUT";
  if (status === 429) return "PROVIDER_RATE_LIMIT";
  return "PROVIDER_REQUEST_FAILED";
}

function extractOpenAiOutputText(body: any): string {
  if (typeof body?.output_text === "string") return body.output_text.trim();
  const output = Array.isArray(body?.output) ? body.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string") return part.text.trim();
    }
  }
  return "";
}

@Injectable()
export class OpenAiTranscriptionProvider implements VoiceTranscriptionProvider {
  readonly name = "openai";

  constructor(@Optional() private readonly config?: ConfigService) {}

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const runtime = resolveSpeechRuntimeConfig(this.config);
    if (!runtime.openaiApiKey) {
      throw new SpeechProviderError("PROVIDER_AUTH_FAILED", "OpenAI API key is not configured");
    }

    const started = Date.now();
    const file = await fetchEvidenceObject(input, globalThis.fetch.bind(globalThis));
    const form = new FormData();
    form.append("model", runtime.openaiSttModel);
    form.append("file", file, `evidence-${input.attachmentId}`);
    form.append("response_format", "json");
    if (input.selectedLanguage && input.selectedLanguage !== "auto") {
      form.append("language", input.selectedLanguage);
    }

    const response = await fetch(OPENAI_AUDIO_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${runtime.openaiApiKey}` },
      body: form,
    });
    if (!response.ok) {
      throw new SpeechProviderError(normalizeOpenAiError(response.status), `OpenAI transcription failed: ${response.status}`);
    }
    const body = (await response.json()) as { text?: unknown; language?: unknown; duration?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      throw new SpeechProviderError("PROVIDER_EMPTY_TRANSCRIPT", "OpenAI transcription returned empty text");
    }

    return {
      transcript: text,
      detectedLanguage: typeof body.language === "string" ? body.language : input.selectedLanguage ?? undefined,
      providerReference: undefined,
      model: runtime.openaiSttModel,
      processingDurationMs: Date.now() - started,
    };
  }
}

@Injectable()
export class OpenAiTranslationProvider implements SpeechTranslationProvider {
  readonly name = "openai";

  constructor(@Optional() private readonly config?: ConfigService) {}

  async translate(input: TranslationInput): Promise<TranslationResult> {
    const runtime = resolveSpeechRuntimeConfig(this.config);
    if (!runtime.openaiApiKey) {
      throw new SpeechProviderError("PROVIDER_AUTH_FAILED", "OpenAI API key is not configured");
    }

    const started = Date.now();
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runtime.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: runtime.openaiTranslationModel,
        input: [
          {
            role: "system",
            content:
              "Translate emergency-safety text for THE EYE. Preserve names, street names, plate numbers, IDs, danger type, numbers, and do not add facts.",
          },
          {
            role: "user",
            content: JSON.stringify({
              sourceLocale: input.sourceLocale ?? "auto",
              targetLocale: input.targetLocale,
              text: input.text,
            }),
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new SpeechProviderError(normalizeOpenAiError(response.status), `OpenAI translation failed: ${response.status}`);
    }
    const body = (await response.json()) as { output_text?: unknown; id?: unknown; output?: unknown };
    const translatedText = extractOpenAiOutputText(body);
    if (!translatedText) {
      throw new SpeechProviderError("PROVIDER_EMPTY_TRANSLATION", "OpenAI translation returned empty text");
    }
    return {
      translatedText,
      providerReference: typeof body.id === "string" ? body.id : undefined,
      model: runtime.openaiTranslationModel,
      processingDurationMs: Date.now() - started,
    };
  }
}
