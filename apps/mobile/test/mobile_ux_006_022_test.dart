import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/design_system/components/eye_cancellation_reason_sheet.dart";
import "package:the_eye_mobile/design_system/components/eye_destructive_button.dart";
import "package:the_eye_mobile/presentation/citizen_notification_presenter.dart";
import "package:the_eye_mobile/presentation/missing_person_age.dart";

void main() {
  group("UX-011 / UX-014 missing person age", () {
    test("accepts exact age and approved ranges", () {
      expect(MissingPersonAge.isExactAge("15"), isTrue);
      expect(MissingPersonAge.isApprovedRange("10-15"), isTrue);
      expect(MissingPersonAge.isValidAgeOrRange("10–15"), isTrue);
      expect(MissingPersonAge.isValidAgeOrRange(""), isFalse);
      expect(MissingPersonAge.isValidAgeOrRange("mid twenties"), isFalse);
    });

    test("builds notification preview for exact and range ages", () {
      expect(
        MissingPersonAge.notificationPreview(
          fullName: "Pele Vic",
          ageOrRange: "15",
          lastSeenFriendly: "4 Aug 2026 at 4:10 PM",
        ),
        "15-year-old Pele Vic was last seen on 4 Aug 2026 at 4:10 PM.",
      );
      expect(
        MissingPersonAge.notificationPreview(
          fullName: "Pele Vic",
          ageOrRange: "10-15",
          lastSeenFriendly: "4 Aug 2026 at 4:10 PM",
        ),
        "Pele Vic, approximately 10–15 years old, was last seen on 4 Aug 2026 at 4:10 PM.",
      );
    });
  });

  group("UX-016 citizen notification presenter", () {
    test("formats broadcast alert and report submitted", () {
      final broadcast = CitizenNotificationPresenter.present(
        type: "BroadcastAlert",
        title: "Missing person: Pele Vic",
        body: "raw",
        createdAt: DateTime.now().subtract(const Duration(minutes: 39)),
        isUnread: true,
        metadata: {
          "fullName": "Pele Vic",
          "ageOrApproximateAge": "15",
          "lastSeenAt": "2026-08-04T15:10:00.000Z",
        },
      );
      expect(broadcast.category, "Broadcast Alert");
      expect(broadcast.preview, contains("15-year-old Pele Vic"));
      expect(broadcast.routeHint, "BROADCAST_DETAILS");

      final submitted = CitizenNotificationPresenter.present(
        type: "IncidentStatusUpdate",
        title: "Your emergency report has been received",
        body: "Your report EYE-260810-AE7C has been successfully submitted.",
        createdAt: DateTime.now(),
        isUnread: false,
        metadata: {"publicReference": "EYE-260810-AE7C"},
      );
      expect(submitted.category, "Emergency Report");
      expect(submitted.preview, contains("EYE-260810-AE7C"));
      expect(submitted.routeHint, "OWN_ACTIVE_INCIDENT");
    });

    test("formats verify active incident with friendly category copy", () {
      final verify = CitizenNotificationPresenter.present(
        type: "NearbyIncidentVerification",
        title: "Can you confirm this suspicious activity?",
        body:
            "A suspicious activity has been reported near your location. Tap to review the incident and confirm whether it is still active.",
        createdAt: DateTime.now(),
        isUnread: true,
        metadata: {"incidentCategory": "SuspiciousActivity"},
      );
      expect(verify.category, "Verify Suspicious Activity");
      expect(verify.title, "Can you confirm this suspicious activity?");
      expect(verify.preview, contains("suspicious activity"));
      expect(verify.preview, isNot(contains("NearbyIncidentVerification")));
    });

    test("uses report category templates instead of generic incident update",
        () {
      for (final category in const [
        "Emergency",
        "Accident",
        "Crime",
        "Fire",
        "Kidnapping",
        "Abuse",
        "SuspiciousActivity",
      ]) {
        final presented = CitizenNotificationPresenter.present(
          type: "ReportSubmitted",
          title: "Incident update",
          body: "Submitted",
          createdAt: DateTime(2026, 8, 13, 14, 45),
          isUnread: true,
          metadata: {
            "incidentCategory": category,
            "publicReference": "EYE-260813-QA",
          },
          now: DateTime(2026, 8, 14, 14, 45),
        );
        expect(presented.category, isNot("Update"));
        expect(presented.category, isNot("Incident update"));
        expect(presented.timestampLabel, isNot(contains("2026-08-13T")));
      }
    });

    test("identifies the subject of a stolen vehicle sighting", () {
      final presented = CitizenNotificationPresenter.present(
        type: "BroadcastSightingReported",
        title: "Update",
        body: "A new sighting was submitted.",
        createdAt: DateTime(2026, 8, 13, 14, 45),
        isUnread: true,
        metadata: const {
          "make": "Toyota",
          "model": "Corolla",
          "registrationMasked": "ABJ 234 GG",
        },
      );
      expect(presented.category, "New Sighting");
      expect(presented.title, contains("Toyota Corolla"));
      expect(presented.title, contains("ABJ 234 GG"));
    });
  });

  group("UX-015 cancellation reason", () {
    test("maps structured codes to audited reason strings", () {
      expect(
        const CancellationReasonResult(reasonCode: "REPORTED_BY_MISTAKE")
            .auditedReason,
        "Reported by mistake",
      );
      expect(
        const CancellationReasonResult(
          reasonCode: "OTHER",
          reasonText: "Neighbor already called",
        ).auditedReason,
        "Other: Neighbor already called",
      );
    });
  });

  group("UX-022 destructive stop control", () {
    testWidgets("renders high-contrast Stop Live Video control",
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData.dark(),
          home: Scaffold(
            body: EyeDestructiveButton(
              label: "Stop Live Video",
              onPressed: () {},
            ),
          ),
        ),
      );
      expect(find.text("Stop Live Video"), findsOneWidget);
      final button = tester.widget<FilledButton>(find.byType(FilledButton));
      final style = button.style;
      expect(style?.minimumSize?.resolve({}), const Size.fromHeight(48));
    });
  });

  group("UX-020 technical data guards", () {
    test("citizen notification sanitizes technical confidence wording", () {
      final presented = CitizenNotificationPresenter.present(
        type: "IncidentStatusUpdate",
        title: "Update",
        body: "Verification confidence scored at 27",
        createdAt: DateTime.now(),
        isUnread: true,
      );
      expect(presented.preview, isNot(contains("confidence")));
      expect(presented.preview, isNot(contains("27")));
    });
  });
}
