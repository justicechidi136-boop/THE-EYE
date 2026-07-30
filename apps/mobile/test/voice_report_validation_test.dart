import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/evidence/local_evidence_attachment.dart";
import "package:the_eye_mobile/voice/voice_report_validation.dart";

void main() {
  group("voice report validation", () {
    test("accepts voice-only drafts", () {
      final attachment = LocalEvidenceAttachment(
        localId: "local-1",
        mediaType: "Audio",
        fileName: "voice.m4a",
        originalPath: "/tmp/voice.m4a",
        uploadPath: "/tmp/voice.m4a",
        contentType: "audio/mp4",
        fileHash: "sha256:abc",
        originalFileHash: "sha256:abc",
        sizeBytes: 1200,
        capturedAt: DateTime.utc(2026, 7, 30),
        durationSeconds: 12,
      );

      expect(
        hasValidReportNarrative(description: "", localMedia: [attachment]),
        isTrue,
      );
    });

    test("rejects empty narrative without voice or media", () {
      expect(hasValidReportNarrative(description: "bad", localMedia: const []), isFalse);
    });
  });
}
