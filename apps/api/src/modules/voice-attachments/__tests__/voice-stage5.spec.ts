import { VoiceModerationProvider } from "../voice-moderation.provider";
import { VoiceTranslationProvider } from "../voice-translation.provider";

describe("VoiceTranslationProvider", () => {
  it("skips translation for English and auto selections", () => {
    const provider = new VoiceTranslationProvider();
    expect(provider.shouldTranslate("en")).toBe(false);
    expect(provider.shouldTranslate("auto")).toBe(false);
    expect(provider.shouldTranslate(null)).toBe(false);
    expect(provider.shouldTranslate("ha")).toBe(true);
  });

  it("returns null without OpenAI key", async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    try {
      delete process.env.OPENAI_API_KEY;
      const provider = new VoiceTranslationProvider();
      const result = await provider.translateToEnglish("Ina kwana", "ha");
      expect(result).toBe(null);
    } finally {
      if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalKey;
    }
  });
});

describe("VoiceModerationProvider", () => {
  it("rejects blocked phrases", async () => {
    const provider = new VoiceModerationProvider();
    const result = await provider.moderateTranscript("This is a bomb threat hoax call", "media-1");
    expect(result.status).toBe("Rejected");
  });

  it("flags empty transcripts", async () => {
    const provider = new VoiceModerationProvider();
    const result = await provider.moderateTranscript("   ", "media-2");
    expect(result.status).toBe("Flagged");
  });

  it("approves normal transcripts without OpenAI key", async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    try {
      delete process.env.OPENAI_API_KEY;
      const provider = new VoiceModerationProvider();
      const result = await provider.moderateTranscript("There is a fire on my street.", "media-3");
      expect(result.status).toBe("Approved");
    } finally {
      if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalKey;
    }
  });
});
