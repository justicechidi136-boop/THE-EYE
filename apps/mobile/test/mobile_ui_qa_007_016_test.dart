import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/contracts/the_eye_enums.dart";
import "package:the_eye_mobile/design_system/components/eye_evidence_card.dart";
import "package:the_eye_mobile/design_system/components/eye_incident_summary_card.dart";
import "package:the_eye_mobile/design_system/components/eye_page_header.dart";
import "package:the_eye_mobile/evidence/local_evidence_attachment.dart";
import "package:the_eye_mobile/presentation/broadcast_expiry_presenter.dart";
import "package:the_eye_mobile/presentation/citizen_date_time.dart";
import "package:the_eye_mobile/presentation/citizen_presentation.dart";
import "package:the_eye_mobile/presentation/evidence_presentation.dart";

void main() {
  group("UI-007 incident summary card", () {
    testWidgets(
        "shows title, reference, status, reported time — no GPS/ISO/UUID",
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EyeIncidentSummaryCard.fromIncidentFields(
              title: "Road Accident",
              incidentId: "11111111-2222-3333-4444-555555555555",
              status: "Verifying",
              reportedAt: DateTime.utc(2026, 8, 10, 20, 42),
              apiPublicReference: "EYE-260810-A72F",
            ),
          ),
        ),
      );

      expect(find.text("Road Accident"), findsOneWidget);
      expect(find.text("EYE-260810-A72F"), findsOneWidget);
      expect(find.text("Verifying"), findsOneWidget);
      expect(find.textContaining("Reported"), findsWidgets);
      expect(find.textContaining("Aug 2026"), findsOneWidget);
      expect(find.textContaining("accuracy"), findsNothing);
      expect(find.textContaining("2026-08-10T"), findsNothing);
      expect(find.textContaining("11111111-2222"), findsNothing);
    });

    testWidgets("long status does not overflow at 1.6 text scale",
        (tester) async {
      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(1.6)),
          child: MaterialApp(
            home: Scaffold(
              body: SizedBox(
                width: 320,
                child: EyeIncidentSummaryCard.fromIncidentFields(
                  title: "Very long translated incident title that wraps",
                  incidentId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                  status: "CancellationRequested",
                  reportedAt: DateTime(2026, 8, 10, 21, 42),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.textContaining("Cancellation"), findsOneWidget);
    });
  });

  group("UI-010 root header", () {
    testWidgets("root header has no back button and uses SafeArea",
        (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: EyePageHeader.root(title: "Services"),
          ),
        ),
      );
      expect(find.text("Services"), findsOneWidget);
      expect(find.byTooltip("Back"), findsNothing);
      expect(find.byType(SafeArea), findsOneWidget);
    });
  });

  group("UI-014 secondary header", () {
    testWidgets("secondary header shows Back", (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: EyePageHeader.secondary(title: "Broadcast Detail"),
          ),
        ),
      );
      expect(find.text("Broadcast Detail"), findsOneWidget);
      expect(find.byTooltip("Back"), findsOneWidget);
    });
  });

  group("UI-012 date formatting", () {
    test("ISO timestamp becomes friendly local display", () {
      final parsed =
          CitizenDateTimeFormatter.tryParse("2026-08-08T17:53:18.510557Z");
      expect(parsed, isNotNull);
      final formatted = CitizenDateTimeFormatter.formatDateTime(parsed!);
      expect(formatted, contains("Aug 2026"));
      expect(formatted, isNot(contains("T17:53")));
      expect(formatted, isNot(contains("Z")));
    });

    test("reported-at uses middle-dot style", () {
      final value = DateTime(2026, 8, 10, 21, 42);
      expect(
        CitizenDateTimeFormatter.formatReportedAt(value),
        "10 Aug 2026 · 9:42 PM",
      );
    });
  });

  group("UI-013 broadcast expiry", () {
    test("future expiry stays Active with Expires in …", () {
      final now = DateTime.utc(2026, 8, 10, 12);
      final presentation = BroadcastExpiryPresenter.present(
        backendStatus: "Active",
        expiresAt: now.add(const Duration(days: 5)),
        now: now,
      );
      expect(presentation.statusLabel, "Active");
      expect(presentation.detailLine, "Expires in 5 days");
      expect(
          presentation.detailLine!.toLowerCase(), isNot(contains("just now")));
    });

    test("past expiresAt with Active backend is non-contradictory Expired", () {
      final now = DateTime.utc(2026, 8, 10, 12);
      final presentation = BroadcastExpiryPresenter.present(
        backendStatus: "Active",
        expiresAt: now.subtract(const Duration(seconds: 1)),
        now: now,
      );
      expect(presentation.statusLabel, "Expired");
      expect(presentation.isExpired, isTrue);
      expect(presentation.backendStatusStale, isTrue);
      expect(presentation.detailLine, isNot(contains("Active")));
      expect(
        "${presentation.statusLabel} ${presentation.detailLine}",
        isNot(contains("Active")),
      );
    });

    test("boundary clock cases", () {
      final now = DateTime.utc(2026, 8, 10, 12);
      expect(
        BroadcastExpiryPresenter.present(
          backendStatus: "Active",
          expiresAt: now.add(const Duration(minutes: 1)),
          now: now,
        ).detailLine,
        "Expires in 1 minute",
      );
      expect(
        BroadcastExpiryPresenter.present(
          backendStatus: "Active",
          expiresAt: now.add(const Duration(hours: 1)),
          now: now,
        ).detailLine,
        "Expires in 1 hour",
      );
      expect(
        BroadcastExpiryPresenter.present(
          backendStatus: "Active",
          expiresAt: now,
          now: now,
        ).statusLabel,
        "Expired",
      );
    });
  });

  group("UI-015/UI-016 evidence presentation", () {
    test("numbers Photo/Video/Audio without technical filenames", () {
      final attachments = [
        _attachment(IncidentMediaType.image,
            "550e8400-e29b-41d4-a716-446655440000.jpg"),
        _attachment(IncidentMediaType.image, "incident_969e_upload.jpg"),
        _attachment(IncidentMediaType.video, "clip.mp4", durationSeconds: 24),
        _attachment(IncidentMediaType.audio, "voice-uuid.m4a", durationSeconds: 12),
        _attachment(IncidentMediaType.image, "third.jpg"),
      ];
      final presentations =
          EvidencePresentationMapper.mapLocalAttachments(attachments);
      expect(presentations.map((p) => p.displayName).toList(), [
        "Photo 1",
        "Photo 2",
        "Video 1 · 00:24",
        "Audio 1 · 00:12",
        "Photo 3",
      ]);
      for (final p in presentations) {
        expect(p.displayName, isNot(contains("550e8400")));
        expect(p.displayName, isNot(contains("uuid")));
        expect(p.displayName, isNot(contains(".jpg")));
      }
    });

    testWidgets("failed upload shows Retry and Remove without UUID title",
        (tester) async {
      final failed = _attachment(
        IncidentMediaType.image,
        "firebase-storage-uuid.jpg",
      ).copyWith(state: LocalEvidenceState.failed, errorMessage: "HTTP 500");
      final presentation = EvidencePresentationMapper.mapLocalAttachment(
        failed,
        indexWithinKind: 2,
      );
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EyeEvidenceCard(
              presentation: presentation,
              onRetry: () {},
              onRemove: () {},
            ),
          ),
        ),
      );
      expect(find.text("Photo 2"), findsOneWidget);
      expect(find.text("Upload failed"), findsOneWidget);
      expect(find.text("Retry"), findsOneWidget);
      expect(find.text("Remove"), findsOneWidget);
      expect(find.text("View"), findsNothing);
      expect(find.textContaining("firebase-storage"), findsNothing);
      expect(find.textContaining("HTTP 500"), findsNothing);
    });

    testWidgets("missing thumbnail does not throw", (tester) async {
      final presentation = EvidencePresentationMapper.mapLocalAttachment(
        _attachment(IncidentMediaType.image, "missing.jpg"),
        indexWithinKind: 1,
      );
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EyeEvidenceCard(presentation: presentation, onRemove: () {}),
          ),
        ),
      );
      expect(tester.takeException(), isNull);
      expect(find.text("Photo 1"), findsOneWidget);
    });
  });

  group("status mapper", () {
    test("maps enums and prefers authoritative displayLabel", () {
      expect(citizenIncidentStatusLabel("Responding"), "Responders En Route");
      expect(
        resolveCitizenIncidentStatusLabel(
          displayLabel: "Custom agency label",
          status: "Verifying",
        ),
        "Custom agency label",
      );
      expect(
        resolveCitizenIncidentStatusLabel(
          displayLabel: "Verifying",
          status: "Verifying",
        ),
        "Verifying",
      );
    });

    test("maps canonical citizen incident category titles", () {
      expect(citizenIncidentCategoryLabel("SuspiciousActivity"),
          "Suspicious Activity");
      expect(citizenIncidentCategoryLabel("EmergencyCase"), "Emergency");
      expect(citizenIncidentCategoryLabel("LiveEmergencyVideo"),
          "Live Emergency Video");
    });
  });
}

LocalEvidenceAttachment _attachment(
  String mediaType,
  String fileName, {
  int? durationSeconds,
}) {
  return LocalEvidenceAttachment(
    localId: "local-$fileName",
    mediaType: mediaType,
    fileName: fileName,
    originalPath: "/tmp/$fileName",
    uploadPath: "/tmp/missing-$fileName",
    contentType: "application/octet-stream",
    fileHash: "hash",
    originalFileHash: "hash",
    sizeBytes: 12,
    capturedAt: DateTime(2026, 8, 10, 21, 44),
    durationSeconds: durationSeconds,
  );
}
