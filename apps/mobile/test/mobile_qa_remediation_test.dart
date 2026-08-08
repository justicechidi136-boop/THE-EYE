import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/auth/social_auth_service.dart";
import "package:the_eye_mobile/emergency/active_emergency_navigation.dart";
import "package:the_eye_mobile/presentation/citizen_presentation.dart";
import "package:the_eye_mobile/presentation/public_reference.dart";

void main() {
  group("UI-007/UI-010 citizen presentation", () {
    test("maps internal statuses to friendly labels", () {
      expect(citizenIncidentStatusLabel("Verifying"), "Verification in progress");
      expect(citizenIncidentStatusLabel("CancelledByReporter"), "Cancelled");
    });

    test("builds deterministic public references", () {
      expect(
        buildIncidentPublicReference(
          incidentId: "11111111-2222-3333-4444-555555555555",
          submittedAt: DateTime.utc(2026, 8, 7, 10, 13),
        ),
        "EYE-260807-5555",
      );
    });

    test("sanitizes timeline messages", () {
      expect(
        citizenTimelineMessage(
          eventType: "AutomaticTriageCompleted",
          message: "Automatic triage completed",
        ),
        "Your report has been routed to the appropriate response team",
      );
    });
  });

  group("UI-006 auth error sanitization", () {
    test("google cancellation stays user friendly", () {
      expect(
        SocialAuthService.shouldFallbackToGoogleSignInPlugin("unknown"),
        isTrue,
      );
    });
  });

  group("NAV-001/FUNC-005 navigation contract", () {
    test("post-submit copy is stable", () {
      expect(
        ActiveEmergencyNavigation.receivedCopy,
        "Your emergency report has been received.",
      );
    });
  });

  group("UX-003 date formatting", () {
    test("formats same-day timestamps as Today", () {
      final now = DateTime(2026, 8, 7, 15, 0);
      final value = DateTime(2026, 8, 7, 10, 13);
      expect(formatCitizenDateTime(value, now: now), startsWith("Today,"));
    });
  });
}
