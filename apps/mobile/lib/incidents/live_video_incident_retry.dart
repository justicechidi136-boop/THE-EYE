import "package:the_eye_mobile/incidents/incident_submission_result.dart";

const liveVideoTransientServerFailurePattern =
    r"ERR-INC-(500|502|503)|temporarily unavailable";

/// Retries live-video incident submission once on transient server failures.
Future<IncidentSubmissionResult> submitLiveVideoIncidentWithRetry({
  required Future<IncidentSubmissionResult> Function() submit,
  Duration retryDelay = const Duration(milliseconds: 800),
  bool Function(String message)? isTransientFailure,
}) async {
  final matcher = isTransientFailure ??
      (message) => RegExp(
            liveVideoTransientServerFailurePattern,
            caseSensitive: false,
          ).hasMatch(message);

  const retryDelays = [Duration.zero, Duration(milliseconds: 800)];
  IncidentSubmissionResult? lastResult;

  for (var attempt = 0; attempt < retryDelays.length; attempt++) {
    if (attempt > 0) {
      await Future<void>.delayed(retryDelay);
    }
    lastResult = await submit();
    if (lastResult.isSuccess || lastResult.isQueued) {
      return lastResult;
    }
    final message = lastResult.userMessage ?? "";
    if (!matcher(message) || attempt == retryDelays.length - 1) {
      return lastResult;
    }
  }

  return lastResult ??
      const IncidentSubmissionResult(
        status: IncidentSubmissionStatus.serverValidationError,
        userMessage:
            "Unable to create incident for live video. Please try again.",
      );
}
