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
