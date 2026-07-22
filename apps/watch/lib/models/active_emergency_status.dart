import "../models/sos_event.dart";

String watchIncidentStatusLabel(String? status) {
  switch (status) {
    case "Submitted":
      return "Submitted";
    case "Received":
    case "Verifying":
      return "Under triage";
    case "Verified":
      return "Awaiting assignment";
    case "Assigned":
      return "Assigned";
    case "Responding":
      return "Responder en route";
    case "Resolved":
      return "Resolved";
    case "Closed":
    case "FalseReport":
      return "Closed";
    default:
      return "Status syncing";
  }
}

bool watchIncidentTerminal(String? status) {
  return status == "Resolved" || status == "Closed" || status == "FalseReport";
}

String watchOperationalBody(SosEventState state) {
  if (state.lifecycle == SosLifecycle.submitting) {
    return "Sending SOS to command center…";
  }
  if (state.offlineQueued) {
    return state.errorMessage ?? "Queued offline — will retry when connected";
  }
  if (state.incidentStatus == null && state.incidentId == null) {
    return "Awaiting incident acknowledgement from command center.";
  }
  if (watchIncidentTerminal(state.incidentStatus)) {
    return "This emergency is closed. Location sharing has stopped.";
  }
  return watchIncidentStatusLabel(state.incidentStatus);
}
