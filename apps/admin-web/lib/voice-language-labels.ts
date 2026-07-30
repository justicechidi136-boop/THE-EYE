const voiceLanguageLabels: Record<string, string> = {
  auto: "Automatic detection",
  en: "English",
  pcm: "Nigerian Pidgin",
  ha: "Hausa",
  yo: "Yoruba",
  ig: "Igbo",
  fr: "French",
  sw: "Swahili",
};

export function formatVoiceLanguageLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return voiceLanguageLabels[code] ?? code;
}
