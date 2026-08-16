import { buildSpeechTranslationJobId, buildVoiceTranscriptionJobId } from "../../../common/queue/queue-jobs";
import { GoogleTranscriptionProvider } from "../google-speech.provider";
import { OpenAiTranscriptionProvider, OpenAiTranslationProvider } from "../openai-speech.provider";
import { assertSpeechRuntimeConfiguration } from "../speech-runtime.config";
import { StubTranscriptionProvider } from "../stub-transcription.provider";
import { StubTranslationProvider } from "../stub-translation.provider";
import { VoiceTranscriptionService } from "../voice-transcription.service";

describe("voice transcription foundation", () => {
  it("builds safe BullMQ job IDs without colons", () => {
    const jobId = buildVoiceTranscriptionJobId("attachment-123");
    expect(jobId).toBe("voice-transcription-attachment-123");
    expect(jobId.includes(":")).toBe(false);

    const translationJobId = buildSpeechTranslationJobId("artifact-123", "ha");
    expect(translationJobId).toBe("speech-translation-artifact-123-ha");
    expect(translationJobId.includes(":")).toBe(false);
  });

  it("stub provider never deletes audio and returns low-confidence transcript", async () => {
    const provider = new StubTranscriptionProvider();
    const result = await provider.transcribe({
      attachmentId: "abc",
      storageKey: "evidence/inc/abc.m4a",
      contentType: "audio/mp4",
      selectedLanguage: "en",
      durationSeconds: 10,
    });
    expect(result.transcript.length).toBeGreaterThan(0);
    expect(result.lowConfidence).toBe(true);
  });
});

describe("Wave 6 speech artifact processing", () => {
  function buildHarness(options: {
    provider?: StubTranscriptionProvider;
    translator?: StubTranslationProvider;
    queue?: any;
    config?: Record<string, unknown>;
  } = {}) {
    const state = {
      media: {
        id: "media-1",
        mediaType: "Audio",
        deletedAt: null,
        objectKey: "evidence/inc-1/audio.m4a",
        contentType: "audio/mp4",
        selectedLanguage: "ha",
        durationSeconds: 12,
        fileHash: "sha256:audio",
        transcriptionStatus: "Queued",
        moderationStatus: "Pending",
      } as any,
      artifact: null as any,
      translations: new Map<string, any>(),
      updatedMedia: [] as any[],
    };

    const prisma = {
      incidentMedia: {
        findUnique: jest.fn(async () => state.media),
        update: jest.fn(async ({ data }) => {
          state.media = { ...state.media, ...data };
          state.updatedMedia.push(data);
          return state.media;
        }),
      },
      communityPostMedia: {
        findUnique: jest.fn(async () => null),
        update: jest.fn(),
      },
      speechArtifact: {
        findUnique: jest.fn(async () => state.artifact),
        upsert: jest.fn(async ({ create, update }) => {
          state.artifact = {
            id: "artifact-1",
            ...(state.artifact ?? {}),
            ...(state.artifact ? update : create),
          };
          return state.artifact;
        }),
      },
      speechTranslation: {
        findUnique: jest.fn(async ({ where }) => state.translations.get(where.speechArtifactId_targetLocale.targetLocale) ?? null),
        upsert: jest.fn(async ({ where, create, update }) => {
          const target = where.speechArtifactId_targetLocale.targetLocale;
          const existing = state.translations.get(target);
          const next = {
            id: `translation-${target}`,
            speechArtifactId: where.speechArtifactId_targetLocale.speechArtifactId,
            targetLocale: target,
            ...(existing ?? create),
            ...(existing ? update : {}),
          };
          state.translations.set(target, next);
          return next;
        }),
        update: jest.fn(async ({ where, data }) => {
          const existing = [...state.translations.values()].find((row) => row.id === where.id);
          const next = { ...existing, ...data };
          state.translations.set(next.targetLocale, next);
          return next;
        }),
      },
    };

    const queue = options.queue ?? {
      getJob: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockResolvedValue({ id: "job-1" }),
      name: "the-eye-test-voice-transcription",
    };
    const service = new VoiceTranscriptionService(
      prisma as never,
      options.provider ?? new StubTranscriptionProvider(),
      options.translator ?? new StubTranslationProvider(),
      queue as never,
      {
        get: (key: string) =>
          ({
            LANGUAGE_AI_RUNTIME_ENABLED: "true",
            THE_EYE_APP_ENV: "test",
            SPEECH_STT_PROVIDER: "stub",
            SPEECH_TRANSLATION_PROVIDER: "stub",
            ...(options.config ?? {}),
          })[key],
      } as never,
    );
    return { service, prisma, queue, state };
  }

  it("keeps API healthy and avoids generated output when speech runtime is disabled", async () => {
    const { service, state } = buildHarness({ config: { LANGUAGE_AI_RUNTIME_ENABLED: "false" } });
    const result = await service.processJob({
      attachmentId: "media-1",
      resourceType: "incident_media",
      idempotencyKey: "voice-transcription-media-1",
    });

    expect(result.status).toBe("runtime_disabled");
    expect(state.artifact.status).toBe("UNSUPPORTED");
    expect(state.artifact.errorCode).toBe("LANGUAGE_AI_RUNTIME_DISABLED");
    expect(state.media.transcript).toBeUndefined();
  });

  it("does not mark uploads queued when speech runtime is disabled", async () => {
    const { service, state, queue } = buildHarness({ config: { LANGUAGE_AI_RUNTIME_ENABLED: "false" } });
    state.media.transcriptionStatus = "Uploaded";
    await service.enqueueIncidentMediaTranscription("media-1");
    expect(state.media.transcriptionStatus).toBe("Uploaded");
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("audio triggers STT and preserves source media integrity", async () => {
    const provider = new StubTranscriptionProvider();
    provider.transcribe = jest.fn().mockResolvedValue({
      transcript: "Ina bukatar taimako",
      detectedLanguage: "ha",
      languageDetectionConfidence: 0.91,
      transcriptionConfidence: 0.88,
      model: "test-stt",
    });
    const { service, state } = buildHarness({ provider });

    const result = await service.processJob({
      attachmentId: "media-1",
      resourceType: "incident_media",
      idempotencyKey: "voice-transcription-media-1",
    });

    expect(result.status).toBe("Completed");
    expect(state.media.objectKey).toBe("evidence/inc-1/audio.m4a");
    expect(state.media.transcript).toBe("Ina bukatar taimako");
    expect(state.artifact.provenance).toBe("TRANSCRIPT");
    expect(state.artifact.sourceLocale).toBe("ha");
    expect(state.artifact.content).toBe("Ina bukatar taimako");
  });

  it("non-audio is ignored", async () => {
    const { service, state } = buildHarness();
    state.media.mediaType = "Image";
    await service.enqueueIncidentMediaTranscription("media-1");
    const result = await service.processJob({
      attachmentId: "media-1",
      resourceType: "incident_media",
      idempotencyKey: "voice-transcription-media-1",
    });
    expect(result.status).toBe("skipped");
  });

  it("dedupes queued transcription jobs", async () => {
    const queue = {
      getJob: jest.fn().mockResolvedValue({ id: "voice-transcription-media-1" }),
      add: jest.fn(),
      name: "the-eye-test-voice-transcription",
    };
    const { service } = buildHarness({ queue });
    await service.enqueueIncidentMediaTranscription("media-1");
    expect(queue.add).not.toHaveBeenCalled();
  });

  for (const locale of ["en", "ha", "yo", "ig", "pcm"]) {
    it(`detects supported locale ${locale}`, async () => {
      const provider = new StubTranscriptionProvider();
      provider.transcribe = jest.fn().mockResolvedValue({
        transcript: `sample ${locale}`,
        detectedLanguage: locale,
        languageDetectionConfidence: 0.8,
        transcriptionConfidence: 0.8,
      });
      const { service, state } = buildHarness({ provider });
      await service.processJob({
        attachmentId: "media-1",
        resourceType: "incident_media",
        idempotencyKey: "voice-transcription-media-1",
      });
      expect(state.artifact.sourceLocale).toBe(locale);
    });
  }

  it("skips same-language translation and caches per target", async () => {
    const { service, state } = buildHarness();
    state.artifact = {
      id: "artifact-1",
      sourceType: "incident_media",
      sourceId: "media-1",
      provenance: "TRANSCRIPT",
      sourceLocale: "ha",
      status: "COMPLETED",
      content: "Ina lafiya",
    };

    const result = await service.enqueueTranslation("artifact-1", "ha");
    expect(result.status).toBe("completed");
    expect(state.translations.get("ha").translatedText).toBe("Ina lafiya");
    expect(state.translations.get("ha").provider).toBe("same-language-skip");
  });

  it("queues and processes different-language translation", async () => {
    const translator = new StubTranslationProvider();
    translator.translate = jest.fn().mockResolvedValue({
      translatedText: "I am safe",
      confidence: 0.9,
      model: "test-translate",
    });
    const { service, state } = buildHarness({ translator });
    state.artifact = {
      id: "artifact-1",
      sourceType: "incident_media",
      sourceId: "media-1",
      provenance: "TRANSCRIPT",
      sourceLocale: "ha",
      status: "COMPLETED",
      content: "Ina lafiya",
    };

    await service.enqueueTranslation("artifact-1", "en");
    await service.processJob({
      speechArtifactId: "artifact-1",
      targetLocale: "en",
      idempotencyKey: "speech-translation-artifact-1-en",
    });

    expect(state.translations.get("en").translatedText).toBe("I am safe");
    expect(state.media.translatedTranscript).toBe("I am safe");
    expect(translator.translate).toHaveBeenCalledWith(expect.objectContaining({
      speechArtifactId: "artifact-1",
      targetLocale: "en",
      text: "Ina lafiya",
    }));
  });

  it("marks STT failures without logging transcript content", async () => {
    const provider = new StubTranscriptionProvider();
    const error = new Error("provider unavailable");
    error.name = "PROVIDER_DOWN";
    provider.transcribe = jest.fn().mockRejectedValue(error);
    const { service, state } = buildHarness({ provider });

    await expect(service.processJob({
      attachmentId: "media-1",
      resourceType: "incident_media",
      idempotencyKey: "voice-transcription-media-1",
    })).rejects.toThrow("provider unavailable");

    expect(state.media.transcriptionStatus).toBe("Failed");
    expect(state.media.transcriptionErrorCode).toBe("PROVIDER_DOWN");
    expect(state.artifact.status).toBe("FAILED");
    expect(JSON.stringify(state.artifact)).not.toContain("provider unavailable");
  });

  it("marks translation failures per target without overwriting transcript", async () => {
    const translator = new StubTranslationProvider();
    const error = new Error("translation unavailable");
    error.name = "TRANSLATION_DOWN";
    translator.translate = jest.fn().mockRejectedValue(error);
    const { service, state } = buildHarness({ translator });
    state.artifact = {
      id: "artifact-1",
      sourceType: "incident_media",
      sourceId: "media-1",
      provenance: "TRANSCRIPT",
      sourceLocale: "ha",
      status: "COMPLETED",
      content: "Ina lafiya",
    };

    await service.enqueueTranslation("artifact-1", "en");
    await expect(service.processJob({
      speechArtifactId: "artifact-1",
      targetLocale: "en",
      idempotencyKey: "speech-translation-artifact-1-en",
    })).rejects.toThrow("translation unavailable");

    expect(state.artifact.content).toBe("Ina lafiya");
    expect(state.translations.get("en").status).toBe("FAILED");
    expect(state.translations.get("en").errorCode).toBe("TRANSLATION_DOWN");
  });
});

describe("speech provider readiness configuration", () => {
  it("blocks stub STT in staging when runtime is enabled", () => {
    expect(() =>
      assertSpeechRuntimeConfiguration({
        THE_EYE_APP_ENV: "staging",
        LANGUAGE_AI_RUNTIME_ENABLED: "true",
        SPEECH_STT_PROVIDER: "stub",
        SPEECH_TRANSLATION_PROVIDER: "openai",
        OPENAI_API_KEY: "test-key",
      }),
    ).toThrow();
  });

  it("allows stub providers in test/dev when runtime is enabled", () => {
    expect(() =>
      assertSpeechRuntimeConfiguration({
        THE_EYE_APP_ENV: "development",
        LANGUAGE_AI_RUNTIME_ENABLED: "true",
        SPEECH_STT_PROVIDER: "stub",
        SPEECH_TRANSLATION_PROVIDER: "stub",
      }),
    ).not.toThrow();
  });

  it("keeps runtime disabled healthy without provider credentials", () => {
    expect(() =>
      assertSpeechRuntimeConfiguration({
        THE_EYE_APP_ENV: "staging",
        LANGUAGE_AI_RUNTIME_ENABLED: "false",
        SPEECH_STT_PROVIDER: "stub",
        SPEECH_TRANSLATION_PROVIDER: "stub",
      }),
    ).not.toThrow();
  });

  it("requires explicit OpenAI credentials when selected", () => {
    expect(() =>
      assertSpeechRuntimeConfiguration({
        THE_EYE_APP_ENV: "staging",
        LANGUAGE_AI_RUNTIME_ENABLED: "true",
        SPEECH_STT_PROVIDER: "openai",
        SPEECH_TRANSLATION_PROVIDER: "openai",
      }),
    ).toThrow();
  });

  it("requires explicit Google credential contract when selected", () => {
    expect(() =>
      assertSpeechRuntimeConfiguration({
        THE_EYE_APP_ENV: "staging",
        LANGUAGE_AI_RUNTIME_ENABLED: "true",
        SPEECH_STT_PROVIDER: "google",
        SPEECH_TRANSLATION_PROVIDER: "google",
        GOOGLE_CLOUD_ACCESS_TOKEN: "test-token",
      }),
    ).toThrow();
  });
});

describe("real speech provider adapters", () => {
  const originalFetch = globalThis.fetch;

  function config(values: Record<string, unknown>) {
    return { get: (key: string) => values[key] } as never;
  }

  it("normalizes OpenAI transcription without fabricating confidence", async () => {
    const calls: string[] = [];
    globalThis.fetch = jest.fn(async (url: string) => {
      calls.push(url);
      if (url.includes("api.openai.com")) {
        return { ok: true, json: async () => ({ text: "Officer down at Marina", language: "en" }) } as never;
      }
      return { ok: true, arrayBuffer: async () => Buffer.from("audio").buffer } as never;
    }) as never;

    const provider = new OpenAiTranscriptionProvider(
      config({ OPENAI_API_KEY: "sk-test", OPENAI_STT_MODEL: "test-transcribe" }),
    );
    const result = await provider.transcribe({
      attachmentId: "media-1",
      storageKey: "evidence/inc/audio.m4a",
      contentType: "audio/mp4",
      selectedLanguage: "en",
    });

    expect(result.transcript).toBe("Officer down at Marina");
    expect(result.model).toBe("test-transcribe");
    expect(result.transcriptionConfidence).toBeUndefined();
    expect(calls.some((url) => url.includes("api.openai.com"))).toBe(true);
    globalThis.fetch = originalFetch;
  });

  it("normalizes OpenAI translation and preserves source/target contract", async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "resp-1",
        output_text: "A child is missing near Ring Road",
      }),
    })) as never;
    const provider = new OpenAiTranslationProvider(
      config({ OPENAI_API_KEY: "sk-test", OPENAI_TRANSLATION_MODEL: "test-translate" }),
    );

    const result = await provider.translate({
      speechArtifactId: "artifact-1",
      sourceContentId: "media-1",
      sourceLocale: "ha",
      targetLocale: "en",
      text: "An rasa yaro kusa da Ring Road",
    });

    expect(result.translatedText).toBe("A child is missing near Ring Road");
    expect(result.providerReference).toBe("resp-1");
    expect(result.model).toBe("test-translate");
    globalThis.fetch = originalFetch;
  });

  it("returns unsupported for Google Pidgin STT instead of relabeling", async () => {
    const provider = new GoogleTranscriptionProvider(
      config({
        GOOGLE_CLOUD_ACCESS_TOKEN: "token",
        GOOGLE_CLOUD_PROJECT: "project",
      }),
    );

    await expect(provider.transcribe({
      attachmentId: "media-2",
      storageKey: "evidence/inc/audio2.m4a",
      contentType: "audio/mp4",
      selectedLanguage: "pcm",
    })).rejects.toThrow("google-stt does not support pcm");
  });

  it("maps provider auth and rate limit failures without leaking keys or transcript text", async () => {
    globalThis.fetch = jest.fn(async (url: string) => {
      if (url.includes("api.openai.com")) return { ok: false, status: 429 } as never;
      return { ok: true, arrayBuffer: async () => Buffer.from("audio").buffer } as never;
    }) as never;
    const provider = new OpenAiTranscriptionProvider(config({ OPENAI_API_KEY: "sk-sensitive-test-key" }));

    await expect(provider.transcribe({
      attachmentId: "media-1",
      storageKey: "evidence/inc/audio.m4a",
      contentType: "audio/mp4",
      selectedLanguage: "en",
    })).rejects.toThrow("OpenAI transcription failed: 429");
    globalThis.fetch = originalFetch;
  });
});
