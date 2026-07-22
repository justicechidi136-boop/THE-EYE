enum ActiveEmergencyPhase {
  sending,
  submitted,
  underTriage,
  awaitingAssignment,
  assigned,
  responderAccepted,
  responderEnRoute,
  responderArrived,
  inProgress,
  resolved,
  cancelled,
  failedOffline,
}

ActiveEmergencyPhase mapIncidentStatusToPhase(String status,
    {bool offlineQueued = false}) {
  if (offlineQueued) return ActiveEmergencyPhase.failedOffline;
  switch (status) {
    case "Submitted":
      return ActiveEmergencyPhase.submitted;
    case "Received":
    case "Verifying":
      return ActiveEmergencyPhase.underTriage;
    case "Verified":
      return ActiveEmergencyPhase.awaitingAssignment;
    case "Assigned":
      return ActiveEmergencyPhase.assigned;
    case "Responding":
      return ActiveEmergencyPhase.responderEnRoute;
    case "Resolved":
      return ActiveEmergencyPhase.resolved;
    case "Closed":
      return ActiveEmergencyPhase.cancelled;
    case "FalseReport":
      return ActiveEmergencyPhase.cancelled;
    default:
      return ActiveEmergencyPhase.submitted;
  }
}

String phaseLabel(ActiveEmergencyPhase phase) {
  switch (phase) {
    case ActiveEmergencyPhase.sending:
      return "Sending";
    case ActiveEmergencyPhase.submitted:
      return "Submitted";
    case ActiveEmergencyPhase.underTriage:
      return "Under triage";
    case ActiveEmergencyPhase.awaitingAssignment:
      return "Awaiting assignment";
    case ActiveEmergencyPhase.assigned:
      return "Assigned";
    case ActiveEmergencyPhase.responderAccepted:
      return "Responder accepted";
    case ActiveEmergencyPhase.responderEnRoute:
      return "Responder en route";
    case ActiveEmergencyPhase.responderArrived:
      return "Responder arrived";
    case ActiveEmergencyPhase.inProgress:
      return "In progress";
    case ActiveEmergencyPhase.resolved:
      return "Resolved";
    case ActiveEmergencyPhase.cancelled:
      return "Cancelled";
    case ActiveEmergencyPhase.failedOffline:
      return "Offline — queued";
  }
}

bool phaseAllowsLocationStreaming(ActiveEmergencyPhase phase) {
  return phase != ActiveEmergencyPhase.resolved &&
      phase != ActiveEmergencyPhase.cancelled &&
      phase != ActiveEmergencyPhase.failedOffline &&
      phase != ActiveEmergencyPhase.sending;
}

bool phaseAllowsCancellation(ActiveEmergencyPhase phase) {
  return phase == ActiveEmergencyPhase.submitted ||
      phase == ActiveEmergencyPhase.underTriage ||
      phase == ActiveEmergencyPhase.awaitingAssignment ||
      phase == ActiveEmergencyPhase.assigned;
}
