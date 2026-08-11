import "active_emergency_contract.dart";

/// Citizen-facing progress steps matching the Claude Active Emergency reference.
enum ActiveEmergencyCitizenProgressKey {
  submitted,
  verifying,
  agency,
  responders,
  resolved,
}

class ActiveEmergencyCitizenProgressStep {
  const ActiveEmergencyCitizenProgressStep({
    required this.key,
    required this.label,
    required this.state,
    this.subLabel,
  });

  final ActiveEmergencyCitizenProgressKey key;
  final String label;
  final ActiveEmergencyProgressStageState state;
  final String? subLabel;
}

/// Collapses the server 9-stage progress definition into the 5-step hub tracker.
List<ActiveEmergencyCitizenProgressStep> collapseActiveEmergencyProgress(
  List<ActiveEmergencyProgressStage> stages,
) {
  ActiveEmergencyProgressStage? find(Set<String> keys) {
    for (final stage in stages) {
      if (keys.contains(stage.key)) return stage;
    }
    return null;
  }

  ActiveEmergencyProgressStageState mergeState(
    List<ActiveEmergencyProgressStage?> parts,
  ) {
    final present = parts.whereType<ActiveEmergencyProgressStage>().toList();
    if (present.isEmpty) return ActiveEmergencyProgressStageState.pending;
    if (present
        .any((s) => s.state == ActiveEmergencyProgressStageState.current)) {
      return ActiveEmergencyProgressStageState.current;
    }
    if (present.every(
      (s) =>
          s.state == ActiveEmergencyProgressStageState.complete ||
          s.state == ActiveEmergencyProgressStageState.skipped,
    )) {
      return ActiveEmergencyProgressStageState.complete;
    }
    if (present
        .any((s) => s.state == ActiveEmergencyProgressStageState.complete)) {
      // Partial completion in a collapsed group still counts as in-progress.
      return ActiveEmergencyProgressStageState.current;
    }
    return ActiveEmergencyProgressStageState.pending;
  }

  String? subFor(ActiveEmergencyProgressStageState state, DateTime? at) {
    if (state == ActiveEmergencyProgressStageState.current) {
      return "In progress";
    }
    if (state == ActiveEmergencyProgressStageState.pending) {
      return "Pending";
    }
    if (state == ActiveEmergencyProgressStageState.skipped) {
      return "Skipped";
    }
    if (at != null) {
      final local = at.toLocal();
      final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
      final minute = local.minute.toString().padLeft(2, "0");
      final suffix = local.hour >= 12 ? "PM" : "AM";
      return "$hour:$minute $suffix";
    }
    return "Complete";
  }

  final submitted = find({"submitted", "received"});
  final verifying = find({"verifying", "verified"});
  final agency = find({"agencyAssigned"});
  final responders = find({"respondersEnRoute", "underControl"});
  final resolved = find({"resolved", "closed"});

  final submittedState = mergeState([submitted]);
  final verifyingState = mergeState([verifying]);
  final agencyState = mergeState([agency]);
  final respondersState = mergeState([responders]);
  final resolvedState = mergeState([resolved]);

  return [
    ActiveEmergencyCitizenProgressStep(
      key: ActiveEmergencyCitizenProgressKey.submitted,
      label: "Submitted",
      state: submittedState,
      subLabel: subFor(submittedState, submitted?.completedAt),
    ),
    ActiveEmergencyCitizenProgressStep(
      key: ActiveEmergencyCitizenProgressKey.verifying,
      label: "Verifying",
      state: verifyingState,
      subLabel: subFor(verifyingState, verifying?.completedAt),
    ),
    ActiveEmergencyCitizenProgressStep(
      key: ActiveEmergencyCitizenProgressKey.agency,
      label: "Agency",
      state: agencyState,
      subLabel: subFor(agencyState, agency?.completedAt),
    ),
    ActiveEmergencyCitizenProgressStep(
      key: ActiveEmergencyCitizenProgressKey.responders,
      label: "Responders",
      state: respondersState,
      subLabel: subFor(respondersState, responders?.completedAt),
    ),
    ActiveEmergencyCitizenProgressStep(
      key: ActiveEmergencyCitizenProgressKey.resolved,
      label: "Resolved",
      state: resolvedState,
      subLabel: subFor(resolvedState, resolved?.completedAt),
    ),
  ];
}

String activeEmergencyProgressNote({
  required List<ActiveEmergencyCitizenProgressStep> steps,
  String? assignedAgencyName,
  String? witnessSummary,
}) {
  final current = steps.cast<ActiveEmergencyCitizenProgressStep?>().firstWhere(
        (step) => step?.state == ActiveEmergencyProgressStageState.current,
        orElse: () => null,
      );
  if (current?.key == ActiveEmergencyCitizenProgressKey.verifying) {
    return witnessSummary?.trim().isNotEmpty == true
        ? witnessSummary!.trim()
        : "Nearby users and our monitoring team are verifying your report.";
  }
  if (current?.key == ActiveEmergencyCitizenProgressKey.agency) {
    return assignedAgencyName == null
        ? "Your report is being routed to a response agency."
        : "Routed to $assignedAgencyName.";
  }
  if (current?.key == ActiveEmergencyCitizenProgressKey.responders) {
    return "Responders are being coordinated for your emergency.";
  }
  if (current?.key == ActiveEmergencyCitizenProgressKey.resolved) {
    return "Your emergency is marked resolved.";
  }
  if (steps.first.state == ActiveEmergencyProgressStageState.complete &&
      current == null) {
    return "Your emergency report has been received.";
  }
  return "Your emergency report has been received.";
}
