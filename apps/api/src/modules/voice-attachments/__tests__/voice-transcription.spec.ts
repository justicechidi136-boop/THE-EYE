import { buildSpeechTranslationJobId, buildVoiceTranscriptionJobId } from "../../../common/queue/queue-jobs";
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
  function buildHarness(options: { provider?: StubTranscriptionProvider; translator?: StubTranslationProvider; queue?: any } = {}) {
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
    );
    return { service, prisma, queue, state };
  }

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
