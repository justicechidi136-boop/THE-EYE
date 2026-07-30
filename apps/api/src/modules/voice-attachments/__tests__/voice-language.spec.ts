import {
  computeSegmentTranscriptionConfidence,
  evaluateTranscriptionQuality,
  formatVoiceLanguageLabel,
  isStage4TranscriptionLanguage,
  isWhisperTranscriptionLanguage,
  normalizeWhisperDetectedLanguage,
  resolveWhisperLanguageHint,
  STAGE4_TRANSCRIPTION_LANGUAGE_CODES,
} from "../voice-language";
import { TranscriptionProviderFactory } from "../transcription-provider.factory";
import { StubTranscriptionProvider } from "../stub-transcription.provider";
import { OpenAiWhisperTranscriptionProvider } from "../openai-whisper-transcription.provider";

describe("voice language mapping", () => {
  it("passes English hint to Whisper and omits Pidgin/auto hints", () => {
    expect(resolveWhisperLanguageHint("en")).toBe("en");
    expect(resolveWhisperLanguageHint("pcm")).toBeUndefined();
    expect(resolveWhisperLanguageHint("auto")).toBeUndefined();
    expect(resolveWhisperLanguageHint(null)).toBeUndefined();
  });

  it("passes Stage 4 language hints to Whisper", () => {
    for (const code of STAGE4_TRANSCRIPTION_LANGUAGE_CODES) {
      expect(resolveWhisperLanguageHint(code)).toBe(code);
      expect(isStage4TranscriptionLanguage(code)).toBe(true);
      expect(isWhisperTranscriptionLanguage(code)).toBe(true);
    }
  });

  it("formats human-readable language labels", () => {
    expect(formatVoiceLanguageLabel("ha")).toBe("Hausa");
    expect(formatVoiceLanguageLabel("yo")).toBe("Yoruba");
    expect(formatVoiceLanguageLabel("unknown")).toBe("unknown");
  });

  it("normalizes Whisper language labels without inventing Pidgin", () => {
    expect(normalizeWhisperDetectedLanguage("english")).toBe("en");
    expect(normalizeWhisperDetectedLanguage("hausa")).toBe("ha");
    expect(normalizeWhisperDetectedLanguage("yoruba")).toBe("yo");
    expect(normalizeWhisperDetectedLanguage("igbo")).toBe("ig");
    expect(normalizeWhisperDetectedLanguage("french")).toBe("fr");
    expect(normalizeWhisperDetectedLanguage("swahili")).toBe("sw");
    expect(normalizeWhisperDetectedLanguage("pidgin")).toBeUndefined();
  });

  it("computes confidence from segment logprobs", () => {
    const confidence = computeSegmentTranscriptionConfidence([{ avg_logprob: -0.2 }, { avg_logprob: -0.1 }]);
    expect(confidence).toBeGreaterThan(0.7);
    expect(confidence).toBeLessThan(1.01);
  });

  it("marks Pidgin selections low-confidence when transcript confidence is below threshold", () => {
    const result = evaluateTranscriptionQuality({
      selectedLanguage: "pcm",
      detectedLanguage: "en",
      transcriptionConfidence: 0.4,
      transcript: "Wetin dey happen for here?",
      threshold: 0.55,
    });
    expect(result.lowConfidence).toBe(true);
    expect(result.languageDetectionConfidence).toBeLessThan(0.76);
  });

  it("flags language mismatch for explicit English selections", () => {
    const result = evaluateTranscriptionQuality({
      selectedLanguage: "en",
      detectedLanguage: "fr",
      transcriptionConfidence: 0.8,
      transcript: "There is an emergency on Broad Street.",
      threshold: 0.55,
    });
    expect(result.lowConfidence).toBe(true);
  });

  it("accepts matching Stage 4 language detection for Hausa", () => {
    const result = evaluateTranscriptionQuality({
      selectedLanguage: "ha",
      detectedLanguage: "ha",
      transcriptionConfidence: 0.82,
      transcript: "An sami gaggawa a nan.",
      threshold: 0.55,
    });
    expect(result.lowConfidence).toBe(false);
  });
});

describe("transcription provider factory", () => {
  const stub = new StubTranscriptionProvider();
  const openAi = new OpenAiWhisperTranscriptionProvider();

  it("selects stub when configured explicitly", () => {
    const originalProvider = process.env.TRANSCRIPTION_PROVIDER;
    const originalKey = process.env.OPENAI_API_KEY;
    try {
      process.env.TRANSCRIPTION_PROVIDER = "stub";
      delete process.env.OPENAI_API_KEY;
      const factory = new TranscriptionProviderFactory(stub, openAi);
      expect(factory.getProvider().name).toBe("stub");
    } finally {
      if (originalProvider === undefined) delete process.env.TRANSCRIPTION_PROVIDER;
      else process.env.TRANSCRIPTION_PROVIDER = originalProvider;
      if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalKey;
    }
  });

  it("selects OpenAI Whisper when configured with API key", () => {
    const originalProvider = process.env.TRANSCRIPTION_PROVIDER;
    const originalKey = process.env.OPENAI_API_KEY;
    try {
      process.env.TRANSCRIPTION_PROVIDER = "openai";
      process.env.OPENAI_API_KEY = "test-key";
      const factory = new TranscriptionProviderFactory(stub, openAi);
      expect(factory.getProvider().name).toBe("openai-whisper");
    } finally {
      if (originalProvider === undefined) delete process.env.TRANSCRIPTION_PROVIDER;
      else process.env.TRANSCRIPTION_PROVIDER = originalProvider;
      if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalKey;
    }
  });
});
