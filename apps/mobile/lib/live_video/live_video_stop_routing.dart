enum LiveVideoStopDestination {
  returnToActiveEmergency,
  openActiveEmergency,
  openIncidentArchive,
  stayOnLiveVideo,
}

class LiveVideoStopRoutingDecision {
  const LiveVideoStopRoutingDecision({
    required this.destination,
    this.incidentId,
  });

  final LiveVideoStopDestination destination;
  final String? incidentId;

  bool get shouldPreserveIncidentId =>
      incidentId != null && incidentId!.isNotEmpty;
}

LiveVideoStopRoutingDecision resolveLiveVideoStopRouting({
  required bool returnToActiveEmergency,
  required String? activeIncidentId,
  bool incidentArchived = false,
}) {
  final incidentId = activeIncidentId?.trim();
  if (incidentArchived && incidentId != null && incidentId.isNotEmpty) {
    return LiveVideoStopRoutingDecision(
      destination: LiveVideoStopDestination.openIncidentArchive,
      incidentId: incidentId,
    );
  }
  if (returnToActiveEmergency) {
    return LiveVideoStopRoutingDecision(
      destination: LiveVideoStopDestination.returnToActiveEmergency,
      incidentId: incidentId,
    );
  }
  if (incidentId != null && incidentId.isNotEmpty) {
    return LiveVideoStopRoutingDecision(
      destination: LiveVideoStopDestination.openActiveEmergency,
      incidentId: incidentId,
    );
  }
  return const LiveVideoStopRoutingDecision(
    destination: LiveVideoStopDestination.stayOnLiveVideo,
  );
}

bool liveVideoStopArchivedIncident(Map<String, dynamic> response) {
  final incident = response["incident"];
  return incident is Map && incident["archived"] == true;
}
