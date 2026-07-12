import "package:flutter/foundation.dart";

import "../incidents/incident_submission_result.dart";

void logRetryResult({
  required String clientSubmissionId,
  required IncidentSubmissionResult result,
  void Function(String message)? sink,
}) {
  final write = sink ?? debugPrint;
  final outcome = result.isSuccess
      ? "success"
      : result.isQueued
          ? "queued"
          : result.status.name;
  write(
    "Pending submission retry: submissionId=$clientSubmissionId outcome=$outcome "
    "incidentId=${result.incidentId ?? "none"}",
  );
}
