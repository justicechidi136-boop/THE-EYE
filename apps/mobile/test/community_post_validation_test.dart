import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/evidence/local_evidence_attachment.dart";
import "package:the_eye_mobile/neighborhood_watch/community_post_validation.dart";

void main() {
  group("community post validation", () {
    test("accepts voice-only posts", () {
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
        hasValidCommunityPostNarrative(body: "", attachments: [attachment]),
        isTrue,
      );
    });

    test("accepts voice-only comments", () {
      final attachment = LocalEvidenceAttachment(
        localId: "local-2",
        mediaType: "Audio",
        fileName: "voice.m4a",
        originalPath: "/tmp/voice.m4a",
        uploadPath: "/tmp/voice.m4a",
        contentType: "audio/mp4",
        fileHash: "sha256:abc",
        originalFileHash: "sha256:abc",
        sizeBytes: 1200,
        capturedAt: DateTime.utc(2026, 7, 30),
        durationSeconds: 8,
      );

      expect(
        hasValidCommunityCommentNarrative(body: "", attachments: [attachment]),
        isTrue,
      );
    });
  });
}
