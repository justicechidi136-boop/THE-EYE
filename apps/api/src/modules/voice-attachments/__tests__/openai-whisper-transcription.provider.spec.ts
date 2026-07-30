import { createS3PresignedGetUrl } from "../../../common/storage/s3-presign";
import { OpenAiWhisperTranscriptionProvider } from "../openai-whisper-transcription.provider";

describe("OpenAiWhisperTranscriptionProvider", () => {
  it("transcribes fetched audio via Whisper verbose_json", async () => {
    const originalFetch = global.fetch;
    const originalApiKey = process.env.OPENAI_API_KEY;
    const originalS3Env = {
      S3_ENDPOINT: process.env.S3_ENDPOINT,
      S3_BUCKET: process.env.S3_BUCKET,
      S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
      S3_SECRET_KEY: process.env.S3_SECRET_KEY,
      S3_REGION: process.env.S3_REGION,
    };

    try {
      process.env.OPENAI_API_KEY = "test-openai-key";
      process.env.S3_ENDPOINT = "https://s3.example.com";
      process.env.S3_BUCKET = "the-eye-evidence";
      process.env.S3_ACCESS_KEY = "test-access-key";
      process.env.S3_SECRET_KEY = "test-secret-key-test-secret-key";
      process.env.S3_REGION = "us-east-1";

      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => Buffer.from("fake-audio").buffer,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: "There is an armed robbery on Allen Avenue.",
            language: "english",
            segments: [{ avg_logprob: -0.15 }],
          }),
        });
      global.fetch = fetchMock as typeof fetch;

      const provider = new OpenAiWhisperTranscriptionProvider();
      const signedUrl = createS3PresignedGetUrl("evidence/inc/media-1.m4a", 600);
      const result = await provider.transcribe({
        attachmentId: "media-1",
        storageKey: "evidence/inc/media-1.m4a",
        contentType: "audio/mp4",
        selectedLanguage: "en",
        durationSeconds: 12,
      });

      expect(fetchMock.mock.calls[0]?.[0]).toBe(signedUrl);
      expect(result.transcript).toContain("armed robbery");
      expect(result.detectedLanguage).toBe("en");
      expect(result.lowConfidence).toBe(false);
      expect(result.providerReference).toBe("whisper-media-1");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      global.fetch = originalFetch;
      if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalApiKey;
      for (const [key, value] of Object.entries(originalS3Env)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("throws when OpenAI returns an error response", async () => {
    const originalFetch = global.fetch;
    const originalApiKey = process.env.OPENAI_API_KEY;
    const originalS3Env = {
      S3_ENDPOINT: process.env.S3_ENDPOINT,
      S3_BUCKET: process.env.S3_BUCKET,
      S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
      S3_SECRET_KEY: process.env.S3_SECRET_KEY,
      S3_REGION: process.env.S3_REGION,
    };

    try {
      process.env.OPENAI_API_KEY = "test-openai-key";
      process.env.S3_ENDPOINT = "https://s3.example.com";
      process.env.S3_BUCKET = "the-eye-evidence";
      process.env.S3_ACCESS_KEY = "test-access-key";
      process.env.S3_SECRET_KEY = "test-secret-key-test-secret-key";
      process.env.S3_REGION = "us-east-1";

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => Buffer.from("fake-audio").buffer,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => "invalid_api_key",
        }) as typeof fetch;

      const provider = new OpenAiWhisperTranscriptionProvider();
      await expect(
        provider.transcribe({
          attachmentId: "media-2",
          storageKey: "evidence/inc/media-2.m4a",
          contentType: "audio/mp4",
          selectedLanguage: "pcm",
        }),
      ).rejects.toThrow(/OpenAI transcription failed \(401\)/);
    } finally {
      global.fetch = originalFetch;
      if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalApiKey;
      for (const [key, value] of Object.entries(originalS3Env)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
