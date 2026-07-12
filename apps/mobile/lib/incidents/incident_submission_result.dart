enum IncidentSubmissionStatus {
  success,
  queuedOffline,
  validationError,
  unauthorized,
  serverValidationError,
  timeout,
  networkError,
  duplicateInFlight,
}

class IncidentSubmissionResult {
  const IncidentSubmissionResult({
    required this.status,
    this.incidentId,
    this.serverStatus,
    this.submittedAt,
    this.userMessage,
    this.fieldErrors = const {},
    this.reportType,
    this.clientSubmissionId,
  });

  final IncidentSubmissionStatus status;
  final String? incidentId;
  final String? serverStatus;
  final DateTime? submittedAt;
  final String? userMessage;
  final Map<String, String> fieldErrors;
  final String? reportType;
  final String? clientSubmissionId;

  bool get isSuccess => status == IncidentSubmissionStatus.success;
  bool get isQueued => status == IncidentSubmissionStatus.queuedOffline;
  bool get canRetry =>
      status == IncidentSubmissionStatus.timeout ||
      status == IncidentSubmissionStatus.networkError ||
      status == IncidentSubmissionStatus.serverValidationError;
}
