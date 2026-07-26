import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/incidents/incident_submission_result.dart";
import "package:the_eye_mobile/incidents/incident_submission_retry.dart";

void main() {
  group("submitIncidentWithTransientRetry", () {
    test("retries once on ERR-INC-502 and succeeds with same clientSubmissionId", () async {
      var calls = 0;
      const clientSubmissionId = "stable-client-submission-id";

      final result = await submitIncidentWithTransientRetry(
        maxAttempts: 2,
        retryDelayForAttempt: (_) => Duration.zero,
        submit: () async {
          calls += 1;
          if (calls == 1) {
            return IncidentSubmissionResult(
              status: IncidentSubmissionStatus.serverValidationError,
              userMessage:
                  "THE EYE servers could not process your report (ERR-INC-502). Please try again shortly.",
              clientSubmissionId: clientSubmissionId,
            );
          }
          return IncidentSubmissionResult(
            status: IncidentSubmissionStatus.success,
            incidentId: "incident-123",
            clientSubmissionId: clientSubmissionId,
          );
        },
      );

      expect(calls, 2);
      expect(result.isSuccess, isTrue);
      expect(result.incidentId, "incident-123");
      expect(result.clientSubmissionId, clientSubmissionId);
    });

    test("does not retry validation failures", () async {
      var calls = 0;
      final result = await submitIncidentWithTransientRetry(
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

    test("does not retry unauthorized failures", () async {
      var calls = 0;
      final result = await submitIncidentWithTransientRetry(
        submit: () async {
          calls += 1;
          return const IncidentSubmissionResult(
            status: IncidentSubmissionStatus.unauthorized,
            userMessage: "Sign in is required to submit this report.",
          );
        },
      );

      expect(calls, 1);
      expect(result.status, IncidentSubmissionStatus.unauthorized);
    });

    test("classifies transient HTTP statuses", () {
      expect(isTransientIncidentHttpStatus(502), isTrue);
      expect(isTransientIncidentHttpStatus(400), isFalse);
      expect(isTransientIncidentHttpStatus(401), isFalse);
      expect(isTransientIncidentHttpStatus(403), isFalse);
    });

    test("does not retry forbidden failures", () async {
      var calls = 0;
      await submitIncidentWithTransientRetry(
        submit: () async {
          calls += 1;
          return const IncidentSubmissionResult(
            status: IncidentSubmissionStatus.unauthorized,
            userMessage: "Sign in is required to submit this report.",
          );
        },
      );

      expect(calls, 1);
    });

    test("returns failure after both transient attempts fail", () async {
      var calls = 0;
      final result = await submitIncidentWithTransientRetry(
        maxAttempts: 2,
        retryDelayForAttempt: (_) => Duration.zero,
        submit: () async {
          calls += 1;
          return const IncidentSubmissionResult(
            status: IncidentSubmissionStatus.serverValidationError,
            userMessage:
                "THE EYE servers could not process your report (ERR-INC-502). Please try again shortly.",
          );
        },
      );

      expect(calls, 2);
      expect(result.userMessage, contains("ERR-INC-502"));
    });

    test("treats Cloudflare gateway HTML as transient via ERR-INC-502 message", () {
      expect(
        isTransientIncidentFailureMessage(
          "THE EYE servers could not process your report (ERR-INC-502). Please try again shortly.",
        ),
        isTrue,
      );
    });
  });
}
