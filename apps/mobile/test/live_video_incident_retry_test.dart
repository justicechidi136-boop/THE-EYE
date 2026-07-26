import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/incidents/incident_submission_result.dart";
import "package:the_eye_mobile/incidents/live_video_incident_retry.dart";

void main() {
  group("submitLiveVideoIncidentWithRetry", () {
    test("retries once on transient 500 and succeeds", () async {
      var calls = 0;
      final result = await submitLiveVideoIncidentWithRetry(
        retryDelay: Duration.zero,
        submit: () async {
          calls += 1;
          if (calls == 1) {
            return const IncidentSubmissionResult(
              status: IncidentSubmissionStatus.serverValidationError,
              userMessage: "THE EYE servers could not process your report (ERR-INC-500).",
            );
          }
          return const IncidentSubmissionResult(
            status: IncidentSubmissionStatus.success,
            incidentId: "incident-123",
          );
        },
      );

      expect(calls, 2);
      expect(result.isSuccess, isTrue);
      expect(result.incidentId, "incident-123");
    });

    test("does not retry on validation 400", () async {
      var calls = 0;
      final result = await submitLiveVideoIncidentWithRetry(
        submit: () async {
          calls += 1;
          return const IncidentSubmissionResult(
            status: IncidentSubmissionStatus.serverValidationError,
            userMessage: "Description is required",
          );
        },
      );

      expect(calls, 1);
      expect(result.userMessage, "Description is required");
    });

    test("does not retry on unauthorized 401", () async {
      var calls = 0;
      final result = await submitLiveVideoIncidentWithRetry(
        submit: () async {
          calls += 1;
          return const IncidentSubmissionResult(
            status: IncidentSubmissionStatus.unauthorized,
            userMessage: "Sign in required",
          );
        },
      );

      expect(calls, 1);
      expect(result.status, IncidentSubmissionStatus.unauthorized);
    });

    test("returns failure after retry still fails", () async {
      var calls = 0;
      final result = await submitLiveVideoIncidentWithRetry(
        retryDelay: Duration.zero,
        submit: () async {
          calls += 1;
          return const IncidentSubmissionResult(
            status: IncidentSubmissionStatus.serverValidationError,
            userMessage: "ERR-INC-502 gateway unavailable",
          );
        },
      );

      expect(calls, 2);
      expect(result.userMessage, contains("ERR-INC-502"));
    });

    test("reuses same submit callback so clientSubmissionId stays stable", () async {
      const draftId = "draft-live-video-1";
      var calls = 0;
      await submitLiveVideoIncidentWithRetry(
        retryDelay: Duration.zero,
        submit: () async {
          calls += 1;
          if (calls == 1) {
            return IncidentSubmissionResult(
              status: IncidentSubmissionStatus.serverValidationError,
              clientSubmissionId: draftId,
              userMessage: "ERR-INC-503 temporarily unavailable",
            );
          }
          return IncidentSubmissionResult(
            status: IncidentSubmissionStatus.success,
            incidentId: "incident-live-1",
            clientSubmissionId: draftId,
          );
        },
      );

      expect(calls, 2);
    });
  });
}
