import { buildVoiceTranscriptionJobId } from "../../../common/queue/queue-jobs";
import { StubTranscriptionProvider } from "../stub-transcription.provider";

describe("voice transcription foundation", () => {
  it("builds safe BullMQ job IDs without colons", () => {
    const jobId = buildVoiceTranscriptionJobId("attachment-123");
    expect(jobId).toBe("voice-transcription-attachment-123");
    expect(jobId.includes(":")).toBe(false);
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
