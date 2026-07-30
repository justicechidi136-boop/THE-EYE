import { Injectable, Logger } from "@nestjs/common";
import { formatVoiceLanguageLabel } from "./voice-language";

export type VoiceTranslationResult = {
  translatedText: string;
  targetLanguage: string;
  providerReference?: string;
};

@Injectable()
export class VoiceTranslationProvider {
  readonly name = "openai-chat";
  private readonly logger = new Logger(VoiceTranslationProvider.name);

  shouldTranslate(sourceLanguage?: string | null): boolean {
    if (!sourceLanguage || sourceLanguage === "auto" || sourceLanguage === "en") {
      return false;
    }
    return true;
  }

  async translateToEnglish(transcript: string, sourceLanguage?: string | null): Promise<VoiceTranslationResult | null> {
    const trimmed = transcript.trim();
    if (!trimmed || !this.shouldTranslate(sourceLanguage)) {
      return null;
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      this.logger.debug("Skipping voice translation because OPENAI_API_KEY is not configured");
      return null;
    }

    const targetLanguage = process.env.VOICE_TRANSLATION_TARGET_LANGUAGE?.trim() || "en";
    const model = process.env.OPENAI_TRANSLATION_MODEL?.trim() || "gpt-4o-mini";
    const sourceLabel = formatVoiceLanguageLabel(sourceLanguage);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Translate public-safety voice report transcripts accurately into English for dispatch review. Preserve names, locations, and urgency. Output only the translation.",
          },
          {
            role: "user",
            content: `Source language: ${sourceLabel}\n\nTranscript:\n${trimmed}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI translation failed (${response.status}): ${body.slice(0, 240)}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const translatedText = payload.choices?.[0]?.message?.content?.trim();
    if (!translatedText) {
      throw new Error("OpenAI translation returned an empty response");
    }

    return {
      translatedText,
      targetLanguage,
      providerReference: `openai-translation-${sourceLanguage ?? "auto"}`,
    };
  }
}
