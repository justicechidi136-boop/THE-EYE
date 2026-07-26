import "dart:math";

import "incident_submission_result.dart";

const incidentTransientHttpStatuses = {500, 502, 503};

bool isTransientIncidentHttpStatus(int statusCode) =>
    incidentTransientHttpStatuses.contains(statusCode);

bool isTransientIncidentFailureMessage(String message) {
  final normalized = message.toLowerCase();
  return normalized.contains("err-inc-500") ||
      normalized.contains("err-inc-502") ||
      normalized.contains("err-inc-503") ||
      normalized.contains("temporarily unavailable");
}

Duration incidentSubmissionRetryDelay(int attempt, {Random? random}) {
  final rng = random ?? Random();
  const baseMs = 400;
  final exponential = baseMs * (1 << attempt.clamp(0, 3));
  final jitter = rng.nextInt(250);
  return Duration(milliseconds: exponential + jitter);
}

/// Retries incident submission on transient server failures while preserving
/// [clientSubmissionId] through the caller's stable submit callback.
Future<IncidentSubmissionResult> submitIncidentWithTransientRetry({
  required Future<IncidentSubmissionResult> Function() submit,
  int maxAttempts = 2,
  Duration Function(int attempt)? retryDelayForAttempt,
  bool Function(IncidentSubmissionResult result)? isTransientFailure,
}) async {
  final matcher = isTransientFailure ??
      (result) {
        if (result.isSuccess || result.isQueued) return false;
        final message = result.userMessage ?? "";
        return isTransientIncidentFailureMessage(message);
      };

  IncidentSubmissionResult? lastResult;
  for (var attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      final delay = retryDelayForAttempt?.call(attempt - 1) ??
          incidentSubmissionRetryDelay(attempt - 1);
      await Future<void>.delayed(delay);
    }

    lastResult = await submit();
    if (lastResult.isSuccess || lastResult.isQueued) {
      return lastResult;
    }
    if (!matcher(lastResult) || attempt == maxAttempts - 1) {
      return lastResult;
    }
  }

  return lastResult ??
      const IncidentSubmissionResult(
        status: IncidentSubmissionStatus.serverValidationError,
        userMessage:
            "THE EYE servers could not process your report (ERR-INC-503). Please try again shortly.",
      );
}
