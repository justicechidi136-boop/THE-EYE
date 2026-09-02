import "dart:io";

import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/evidence/evidence_attachment_picker.dart";
import "package:the_eye_mobile/evidence/evidence_policy.dart";
import "package:the_eye_mobile/widgets/section_card.dart";

void main() {
  test("primary missing-person photo policy accepts exactly one image", () {
    expect(EvidencePolicy.primaryPhoto.maxPhotos, 1);
    expect(EvidencePolicy.primaryPhoto.maxVideos, 0);
    expect(EvidencePolicy.primaryPhoto.maxAudio, 0);
    expect(EvidencePolicy.primaryPhoto.maxFiles, 1);
  });

  test("missing-person submission sends primary photo separately", () {
    final source = File("lib/main.dart").readAsStringSync();
    expect(source, contains("primaryIdentificationStyle: true"));
    expect(source, contains('"primaryPhoto": uploadedPrimary.first'));
    expect(source, contains("Add one clear primary face photo."));

    final gender = source.indexOf('labelText: "Gender"');
    final primaryPhoto = source.indexOf("primaryIdentificationStyle: true");
    final lastSeen = source.indexOf('title: const Text("Last seen date")');
    expect(gender, greaterThanOrEqualTo(0));
    expect(primaryPhoto, greaterThan(gender));
    expect(lastSeen, greaterThan(primaryPhoto));
  });

  test("missing-person ID photo uses the approved dedicated presentation", () {
    final source = File(
      "lib/evidence/evidence_attachment_picker.dart",
    ).readAsStringSync();
    expect(source, contains("Add recent photo"));
    expect(source, contains("Clear face, good lighting"));
    expect(source, contains("Missing person photo"));
    expect(source, contains('label: "Camera"'));
    expect(source, contains('label: "Gallery"'));
    expect(source, contains('const Text("Replace")'));
    expect(source, contains('const Text("Remove")'));
  });

  for (final size in const [
    Size(390, 844),
    Size(412, 915),
    Size(480, 960),
    Size(768, 1024),
  ]) {
    testWidgets("dedicated ID photo surface matches ${size.width.toInt()}px",
        (tester) async {
      await tester.binding.setSurfaceSize(size);
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              padding: EdgeInsets.all(16),
              child: ManagedEvidenceSection(
                lowDataMode: false,
                policy: EvidencePolicy.primaryPhoto,
                primaryIdentificationStyle: true,
              ),
            ),
          ),
        ),
      );

      expect(find.text("Add recent photo"), findsOneWidget);
      expect(find.text("Clear face, good lighting"), findsOneWidget);
      expect(find.byType(SectionCard), findsNothing);
      expect(tester.takeException(), isNull);

      await tester.tap(find.text("Add recent photo"));
      await tester.pumpAndSettle();
      expect(find.text("Add photo"), findsOneWidget);
      expect(find.text("Camera"), findsOneWidget);
      expect(find.text("Gallery"), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
