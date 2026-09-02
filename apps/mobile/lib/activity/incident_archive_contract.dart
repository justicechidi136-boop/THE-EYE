import "../emergency/active_emergency_contract.dart";
import "../emergency/active_emergency_progress_presentation.dart";
import "../presentation/citizen_presentation.dart";

enum ArchivedEmergencyTerminalState {
  ended,
  resolved,
  cancelled,
  closed,
  other
}

class IncidentArchiveContract {
  const IncidentArchiveContract({
    required this.incidentId,
    required this.publicReference,
    required this.category,
    required this.title,
    required this.status,
    required this.terminalState,
    required this.reportedAt,
    required this.location,
    required this.evidence,
    required this.timeline,
    required this.dispatchTimeline,
    required this.verificationStatus,
    this.description,
    this.terminalAt,
    this.finalReason,
    this.resolutionSource,
    this.agency,
    this.communitySummary,
  });

  final String incidentId;
  final String publicReference;
  final String category;
  final String title;
  final String status;
  final ArchivedEmergencyTerminalState terminalState;
  final DateTime reportedAt;
  final DateTime? terminalAt;
  final String? description;
  final String? finalReason;
  final String? resolutionSource;
  final String? agency;
  final String verificationStatus;
  final String? communitySummary;
  final IncidentArchiveLocation location;
  final List<IncidentArchiveEvidenceItem> evidence;
  final List<IncidentArchiveTimelineEntry> timeline;
  final List<IncidentArchiveDispatchEntry> dispatchTimeline;

  String get terminalLabel => switch (terminalState) {
        ArchivedEmergencyTerminalState.ended => "Ended",
        ArchivedEmergencyTerminalState.resolved => "Resolved",
        ArchivedEmergencyTerminalState.cancelled => "Cancelled",
        ArchivedEmergencyTerminalState.closed => "Closed",
        ArchivedEmergencyTerminalState.other => _citizenStatus(status),
      };

  String get terminalBannerLabel =>
      terminalState == ArchivedEmergencyTerminalState.ended
          ? "Live emergency ended"
          : "Incident ${terminalLabel.toLowerCase()}";

  List<ActiveEmergencyCitizenProgressStep> get progressSteps {
    bool timelineHas(Iterable<String> terms) {
      return timeline.any((entry) {
        final value = "${entry.type} ${entry.label}".toLowerCase();
        return terms.any(value.contains);
      });
    }

    bool dispatchHas(Iterable<String> terms) {
      return dispatchTimeline.any((entry) {
        final value = entry.label.toLowerCase();
        return terms.any(value.contains);
      });
    }

    final verificationReached = timelineHas(["verif", "triage"]);
    final agencyReached = dispatchTimeline.isNotEmpty ||
        timelineHas(["agency assigned", "assignment.created"]);
    final respondersReached = dispatchHas([
          "accepted",
          "en route",
          "on scene",
          "arrived",
          "completed",
        ]) ||
        timelineHas(["responder", "response en route", "response arrived"]);
    final resolved = terminalState == ArchivedEmergencyTerminalState.ended ||
        terminalState == ArchivedEmergencyTerminalState.resolved ||
        terminalState == ArchivedEmergencyTerminalState.closed;

    ActiveEmergencyCitizenProgressStep step(
      ActiveEmergencyCitizenProgressKey key,
      String label,
      bool complete,
    ) {
      return ActiveEmergencyCitizenProgressStep(
        key: key,
        label: label,
        state: complete
            ? ActiveEmergencyProgressStageState.complete
            : ActiveEmergencyProgressStageState.skipped,
        subLabel: complete ? "Complete" : "Not reached",
      );
    }

    return [
      step(ActiveEmergencyCitizenProgressKey.submitted, "Submitted", true),
      step(
        ActiveEmergencyCitizenProgressKey.verifying,
        "Verification",
        verificationReached,
      ),
      step(ActiveEmergencyCitizenProgressKey.agency, "Agency", agencyReached),
      step(
        ActiveEmergencyCitizenProgressKey.responders,
        "Responders",
        respondersReached,
      ),
      step(
        ActiveEmergencyCitizenProgressKey.resolved,
        terminalState == ArchivedEmergencyTerminalState.cancelled
            ? "Cancelled"
            : terminalLabel,
        resolved || terminalState == ArchivedEmergencyTerminalState.cancelled,
      ),
    ];
  }

  factory IncidentArchiveContract.fromJson(Map<String, dynamic> json) {
    final status = _requiredString(json, "status");
    final terminalState = _terminalState(status);
    final reportedAt = _requiredDate(json, "createdAt");
    final terminalAt = _date(
          json[terminalState == ArchivedEmergencyTerminalState.ended
              ? "endedAt"
              : terminalState == ArchivedEmergencyTerminalState.cancelled
                  ? "cancelledAt"
                  : terminalState == ArchivedEmergencyTerminalState.closed
                      ? "closedAt"
                      : "resolvedAt"],
        ) ??
        _date(json["endedAt"]) ??
        _date(json["closedAt"]) ??
        _date(json["resolvedAt"]) ??
        _date(json["cancelledAt"]);
    final location = _map(json["location"]);
    final community = _map(json["communityVerificationSummary"]);
    final incidentId = _requiredString(json, "incidentId");

    final communitySummary = _clean(community?["safeSummaryText"]);
    final terminalCommunitySummary = _terminalCommunitySummary(
      terminalState,
      communitySummary,
    );
    return IncidentArchiveContract(
      incidentId: incidentId,
      publicReference: resolveIncidentPublicReference(
        incidentId: incidentId,
        submittedAt: reportedAt,
        apiPublicReference: _clean(json["publicReference"]),
      ),
      category: _clean(json["category"]) ?? "Emergency",
      title: _clean(json["title"]) ?? "Emergency",
      description: _clean(json["description"]),
      status: status,
      terminalState: terminalState,
      reportedAt: reportedAt,
      terminalAt: terminalAt,
      finalReason: _clean(json["resolutionNotes"]),
      resolutionSource: _clean(json["resolutionSource"]),
      agency: _clean(json["agency"]),
      verificationStatus: _citizenVerification(
        _clean(json["verificationStatus"]),
      ),
      communitySummary: terminalCommunitySummary,
      location: IncidentArchiveLocation(
        address: _clean(location?["address"]),
        jurisdiction: _clean(location?["jurisdiction"]),
        accuracyMeters: (location?["accuracyMeters"] as num?)?.toDouble(),
        capturedAt: _date(location?["capturedAt"]),
      ),
      evidence: _list(
        json["evidenceGallery"],
      ).map(IncidentArchiveEvidenceItem.fromJson).toList(growable: false),
      timeline: _list(json["timeline"])
          .map(IncidentArchiveTimelineEntry.fromJson)
          .where((entry) => entry.at != null)
          .toList(growable: false)
        ..sort((a, b) => a.at!.compareTo(b.at!)),
      dispatchTimeline: _list(json["dispatchTimeline"])
          .map(IncidentArchiveDispatchEntry.fromJson)
          .where((entry) => entry.at != null)
          .toList(growable: false)
        ..sort((a, b) => a.at!.compareTo(b.at!)),
    );
  }
}

String? _terminalCommunitySummary(
  ArchivedEmergencyTerminalState state,
  String? summary,
) {
  if (state == ArchivedEmergencyTerminalState.ended) {
    return "Community verification is complete for this incident.";
  }
  if (summary == null) return null;
  final lowered = summary.toLowerCase();
  final soundsActive = lowered.contains("in progress") ||
      lowered.contains("continuing") ||
      lowered.contains("ongoing");
  if (!soundsActive) return summary;
  return switch (state) {
    ArchivedEmergencyTerminalState.ended =>
      "Community verification is complete for this incident.",
    ArchivedEmergencyTerminalState.cancelled =>
      "Community verification ended when this incident was cancelled.",
    ArchivedEmergencyTerminalState.resolved =>
      "Community verification is complete for this resolved incident.",
    ArchivedEmergencyTerminalState.closed =>
      "Community verification is complete for this closed incident.",
    ArchivedEmergencyTerminalState.other => summary,
  };
}

class IncidentArchiveLocation {
  const IncidentArchiveLocation({
    this.address,
    this.jurisdiction,
    this.accuracyMeters,
    this.capturedAt,
  });

  final String? address;
  final String? jurisdiction;
  final double? accuracyMeters;
  final DateTime? capturedAt;

  String get label {
    final parts = <String>[];
    for (final value in [address, jurisdiction]) {
      final clean = value?.trim();
      if (clean != null &&
          clean.isNotEmpty &&
          !parts.any((item) => item.toLowerCase() == clean.toLowerCase())) {
        parts.add(clean);
      }
    }
    return parts.isEmpty ? "Location unavailable" : parts.join("\n");
  }
}

class IncidentArchiveEvidenceItem {
  const IncidentArchiveEvidenceItem({
    required this.id,
    required this.mediaType,
    required this.uploadedAt,
    this.durationSeconds,
  });

  final String id;
  final String mediaType;
  final DateTime uploadedAt;
  final int? durationSeconds;

  factory IncidentArchiveEvidenceItem.fromJson(Map<String, dynamic> json) {
    return IncidentArchiveEvidenceItem(
      id: _requiredString(json, "id"),
      mediaType: _clean(json["mediaType"]) ?? "evidence",
      uploadedAt: _requiredDate(json, "uploadedAt"),
      durationSeconds: json["durationSeconds"] is num
          ? (json["durationSeconds"] as num).round()
          : null,
    );
  }
}

class IncidentArchiveTimelineEntry {
  const IncidentArchiveTimelineEntry({
    required this.label,
    required this.type,
    required this.at,
  });

  final String label;
  final String type;
  final DateTime? at;

  factory IncidentArchiveTimelineEntry.fromJson(Map<String, dynamic> json) {
    return IncidentArchiveTimelineEntry(
      label: _clean(json["label"]) ?? "Incident update",
      type: _clean(json["type"]) ?? "update",
      at: _date(json["at"]),
    );
  }
}

class IncidentArchiveDispatchEntry {
  const IncidentArchiveDispatchEntry({
    required this.label,
    required this.at,
    this.agency,
  });

  final String label;
  final DateTime? at;
  final String? agency;

  factory IncidentArchiveDispatchEntry.fromJson(Map<String, dynamic> json) {
    return IncidentArchiveDispatchEntry(
      label: _clean(json["label"]) ?? "Dispatch update",
      at: _date(json["at"]),
      agency: _clean(json["agency"]),
    );
  }
}

ArchivedEmergencyTerminalState _terminalState(String status) {
  final value = status.toLowerCase();
  if (value == "ended") return ArchivedEmergencyTerminalState.ended;
  if (value.contains("cancel")) return ArchivedEmergencyTerminalState.cancelled;
  if (value.contains("resolve")) return ArchivedEmergencyTerminalState.resolved;
  if (value.contains("close")) return ArchivedEmergencyTerminalState.closed;
  return ArchivedEmergencyTerminalState.other;
}

String _citizenStatus(String value) {
  final spaced = value.replaceAllMapped(
    RegExp(r"([a-z])([A-Z])"),
    (match) => "${match.group(1)} ${match.group(2)}",
  );
  return spaced.isEmpty
      ? "Completed"
      : "${spaced[0].toUpperCase()}${spaced.substring(1).toLowerCase()}";
}

String _citizenVerification(String? value) {
  final lower = value?.toLowerCase() ?? "";
  if (lower.contains("verified") || lower.contains("confirm")) {
    return "Verified";
  }
  if (lower.contains("unable") || lower.contains("inconclusive")) {
    return "Unable to verify";
  }
  return "Not verified";
}

String _requiredString(Map<String, dynamic> json, String key) {
  final value = _clean(json[key]);
  if (value == null) throw const FormatException("Malformed incident archive");
  return value;
}

DateTime _requiredDate(Map<String, dynamic> json, String key) {
  final value = _date(json[key]);
  if (value == null) throw const FormatException("Malformed incident archive");
  return value;
}

DateTime? _date(Object? value) => DateTime.tryParse(value?.toString() ?? "");

String? _clean(Object? value) {
  final result = value?.toString().trim();
  return result == null || result.isEmpty ? null : result;
}

Map<String, dynamic>? _map(Object? value) =>
    value is Map ? Map<String, dynamic>.from(value) : null;

List<Map<String, dynamic>> _list(Object? value) => value is List
    ? value
        .whereType<Map>()
        .map((entry) => Map<String, dynamic>.from(entry))
        .toList(growable: false)
    : const [];
