enum ActiveEmergencyErrorCode {
  contractUnavailable,
  unauthorized,
  malformedContract,
  staleActionConflict,
  cancellationRejected,
  reporterStatusRejected,
  evidenceUploadFailed,
  networkTemporary,
}

class ActiveEmergencyContractException implements Exception {
  ActiveEmergencyContractException(this.code, this.message);

  final ActiveEmergencyErrorCode code;
  final String message;

  @override
  String toString() => "ActiveEmergencyContractException($code): $message";
}

String activeEmergencyErrorLabel(ActiveEmergencyErrorCode code) {
  switch (code) {
    case ActiveEmergencyErrorCode.contractUnavailable:
      return "Active emergency information is temporarily unavailable.";
    case ActiveEmergencyErrorCode.unauthorized:
      return "This emergency report is not available to your account.";
    case ActiveEmergencyErrorCode.malformedContract:
      return "The server returned an invalid active emergency response.";
    case ActiveEmergencyErrorCode.staleActionConflict:
      return "This action is no longer available. The screen has been refreshed.";
    case ActiveEmergencyErrorCode.cancellationRejected:
      return "Cancellation could not be completed.";
    case ActiveEmergencyErrorCode.reporterStatusRejected:
      return "Your status update could not be recorded.";
    case ActiveEmergencyErrorCode.evidenceUploadFailed:
      return "Evidence upload failed. You can retry from Active Emergency.";
    case ActiveEmergencyErrorCode.networkTemporary:
      return "Network connection lost. Showing the last known update.";
  }
}
