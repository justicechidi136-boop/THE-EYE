import "dart:io";

import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/evidence/evidence_policy.dart";

void main() {
  test("primary missing-person photo policy accepts exactly one image", () {
    expect(EvidencePolicy.primaryPhoto.maxPhotos, 1);
    expect(EvidencePolicy.primaryPhoto.maxVideos, 0);
    expect(EvidencePolicy.primaryPhoto.maxAudio, 0);
    expect(EvidencePolicy.primaryPhoto.maxFiles, 1);
  });

  test("missing-person submission sends primary photo separately", () {
    final source = File("lib/main.dart").readAsStringSync();
    expect(source, contains('title: "Primary face photo"'));
    expect(source, contains('"primaryPhoto": uploadedPrimary.first'));
    expect(source, contains("Add one clear primary face photo."));
  });
}
