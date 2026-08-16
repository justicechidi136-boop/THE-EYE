import type { ConfigService } from "@nestjs/config";
import { resolveAppEnvironment } from "../../common/auth/firebase-environment";

export type SpeechSttProviderName = "stub" | "openai" | "google";
export type SpeechTranslationProviderName = "stub" | "openai" | "google";

export const SPEECH_STT_PROVIDER_VALUES: SpeechSttProviderName[] = ["stub", "openai", "google"];
export const SPEECH_TRANSLATION_PROVIDER_VALUES: SpeechTranslationProviderName[] = ["stub", "openai", "google"];

export type SpeechRuntimeConfig = {
  runtimeEnabled: boolean;
  appEnvironment: string;
  sttProvider: SpeechSttProviderName;
  translationProvider: SpeechTranslationProviderName;
  openaiApiKey?: string;
  openaiSttModel: string;
  openaiTranslationModel: string;
  googleAccessToken?: string;
  googleProjectId?: string;
  googleLocation: string;
  googleSttModel: string;
  googleTranslationModel: string;
};

function readConfigValue(config: ConfigService | Record<string, unknown> | undefined, key: string): string | undefined {
  const value =
    typeof (config as ConfigService | undefined)?.get === "function"
      ? (config as ConfigService).get<string>(key)
      : (config as Record<string, unknown> | undefined)?.[key];
  const trimmed = String(value ?? "").trim();
  return trimmed || undefined;
}

function readBoolean(config: ConfigService | Record<string, unknown> | undefined, key: string, fallback = false): boolean {
  const value = readConfigValue(config, key);
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

function readProvider<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T, envName: string): T {
  const normalized = (value ?? fallback).trim().toLowerCase();
  if ((allowed as readonly string[]).includes(normalized)) return normalized as T;
  throw new Error(`${envName} must be one of: ${allowed.join(", ")}`);
}

export function resolveSpeechRuntimeConfig(
  config: ConfigService | Record<string, unknown> | undefined = process.env,
): SpeechRuntimeConfig {
  return {
    runtimeEnabled: readBoolean(config, "LANGUAGE_AI_RUNTIME_ENABLED", false),
    appEnvironment: resolveAppEnvironment({
      THE_EYE_APP_ENV: readConfigValue(config, "THE_EYE_APP_ENV"),
      NODE_ENV: readConfigValue(config, "NODE_ENV") ?? process.env.NODE_ENV,
    }),
    sttProvider: readProvider(
      readConfigValue(config, "SPEECH_STT_PROVIDER"),
      SPEECH_STT_PROVIDER_VALUES,
      "stub",
      "SPEECH_STT_PROVIDER",
    ),
    translationProvider: readProvider(
      readConfigValue(config, "SPEECH_TRANSLATION_PROVIDER"),
      SPEECH_TRANSLATION_PROVIDER_VALUES,
      "stub",
      "SPEECH_TRANSLATION_PROVIDER",
    ),
    openaiApiKey: readConfigValue(config, "OPENAI_API_KEY"),
    openaiSttModel: readConfigValue(config, "OPENAI_STT_MODEL") ?? "gpt-4o-mini-transcribe",
    openaiTranslationModel: readConfigValue(config, "OPENAI_TRANSLATION_MODEL") ?? "gpt-4o-mini",
    googleAccessToken: readConfigValue(config, "GOOGLE_CLOUD_ACCESS_TOKEN"),
    googleProjectId: readConfigValue(config, "GOOGLE_CLOUD_PROJECT") ?? readConfigValue(config, "GOOGLE_PROJECT_ID"),
    googleLocation: readConfigValue(config, "GOOGLE_CLOUD_LOCATION") ?? "us-central1",
    googleSttModel: readConfigValue(config, "GOOGLE_STT_MODEL") ?? "chirp_2",
    googleTranslationModel: readConfigValue(config, "GOOGLE_TRANSLATION_MODEL") ?? "general/nmt",
  };
}

export function isSpeechRuntimeProductionLike(config: SpeechRuntimeConfig): boolean {
  return config.appEnvironment === "staging" || config.appEnvironment === "production";
}

export function assertSpeechRuntimeConfiguration(config: ConfigService | Record<string, unknown> | undefined = process.env) {
  const resolved = resolveSpeechRuntimeConfig(config);
  if (!resolved.runtimeEnabled) return resolved;

  if (isSpeechRuntimeProductionLike(resolved)) {
    if (resolved.sttProvider === "stub") {
      throw new Error("SPEECH_STT_PROVIDER=stub is not allowed when LANGUAGE_AI_RUNTIME_ENABLED=true in staging/production");
    }
    if (resolved.translationProvider === "stub") {
      throw new Error(
        "SPEECH_TRANSLATION_PROVIDER=stub is not allowed when LANGUAGE_AI_RUNTIME_ENABLED=true in staging/production",
      );
    }
  }

  if ((resolved.sttProvider === "openai" || resolved.translationProvider === "openai") && !resolved.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required when an OpenAI speech provider is selected");
  }

  if ((resolved.sttProvider === "google" || resolved.translationProvider === "google") && !resolved.googleAccessToken) {
    throw new Error("GOOGLE_CLOUD_ACCESS_TOKEN is required when a Google speech provider is selected");
  }

  if ((resolved.sttProvider === "google" || resolved.translationProvider === "google") && !resolved.googleProjectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT is required when a Google speech provider is selected");
  }

  return resolved;
}
