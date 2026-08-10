import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/auth/social_auth_service.dart";
import "package:the_eye_mobile/broadcasts/broadcast_ui_helpers.dart";
import "package:the_eye_mobile/emergency/active_emergency_navigation.dart";
import "package:the_eye_mobile/presentation/citizen_presentation.dart";
import "package:the_eye_mobile/presentation/public_reference.dart";

void main() {
  group("UI-007/UI-010 citizen presentation", () {
    test("maps internal statuses to friendly labels", () {
      expect(citizenIncidentStatusLabel("Verifying"), "Verifying");
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

  group("UI-014 broadcast expiry", () {
    test("future expiresAt never says Just now", () {
      final future = DateTime.now().add(const Duration(hours: 2, minutes: 5));
      expect(formatBroadcastExpiry(future), startsWith("Expires in"));
      expect(formatBroadcastAge(future), isNot(equals("Just now")));
      expect(formatBroadcastAge(future), startsWith("Expires in"));
    });

    test("past expiresAt is Expired", () {
      final past = DateTime.now().subtract(const Duration(hours: 1));
      expect(formatBroadcastExpiry(past), startsWith("Expired"));
      expect(formatBroadcastExpiry(past).toLowerCase(), isNot(contains("just now")));
    });
  });
}
