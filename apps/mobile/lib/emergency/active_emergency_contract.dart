/// Strict mobile contract for `GET /v1/incidents/:incidentId/active-emergency`.
library;

import "active_emergency_errors.dart";

enum ActiveEmergencyProgressStageState {
  pending,
  current,
  complete,
  skipped,
}

class ActiveEmergencyProgressStage {
  const ActiveEmergencyProgressStage({
    required this.key,
    required this.label,
    required this.state,
    this.completedAt,
  });

  final String key;
  final String label;
  final ActiveEmergencyProgressStageState state;
  final DateTime? completedAt;

  factory ActiveEmergencyProgressStage.fromJson(Map<String, dynamic> json) {
    final key = _requiredString(json, "key", field: "progressStages.key");
    final label = _requiredString(json, "label", field: "progressStages.label");
    final stateRaw = _requiredString(json, "state", field: "progressStages.state");
    final state = switch (stateRaw) {
      "pending" => ActiveEmergencyProgressStageState.pending,
      "current" => ActiveEmergencyProgressStageState.current,
      "complete" => ActiveEmergencyProgressStageState.complete,
      "skipped" => ActiveEmergencyProgressStageState.skipped,
      _ => throw ActiveEmergencyContractException(
          ActiveEmergencyErrorCode.malformedContract,
          "Invalid progress stage state: $stateRaw",
        ),
    };
    return ActiveEmergencyProgressStage(
      key: key,
      label: label,
      state: state,
      completedAt: _optionalDateTime(json["completedAt"]),
    );
  }
}

class ActiveEmergencyAllowedActions {
  const ActiveEmergencyAllowedActions({
    required this.addEvidence,
    required this.cancel,
    required this.requestCancellation,
    required this.confirmResolved,
    required this.confirmStillOngoing,
    required this.addWrittenUpdate,
    required this.updateLocation,
    required this.retryLiveVideo,
  });

  final bool addEvidence;
  final bool cancel;
  final bool requestCancellation;
  final bool confirmResolved;
  final bool confirmStillOngoing;
  final bool addWrittenUpdate;
  final bool updateLocation;
  final bool retryLiveVideo;

  factory ActiveEmergencyAllowedActions.fromJson(Map<String, dynamic> json) {
    return ActiveEmergencyAllowedActions(
      addEvidence: _requiredBool(json, "addEvidence"),
      cancel: _requiredBool(json, "cancel"),
      requestCancellation: _requiredBool(json, "requestCancellation"),
      confirmResolved: _requiredBool(json, "confirmResolved"),
      confirmStillOngoing: _requiredBool(json, "confirmStillOngoing"),
      addWrittenUpdate: _requiredBool(json, "addWrittenUpdate"),
      updateLocation: _requiredBool(json, "updateLocation"),
      retryLiveVideo: _requiredBool(json, "retryLiveVideo"),
    );
  }

  static ActiveEmergencyAllowedActions empty() => const ActiveEmergencyAllowedActions(
        addEvidence: false,
        cancel: false,
        requestCancellation: false,
        confirmResolved: false,
        confirmStillOngoing: false,
        addWrittenUpdate: false,
        updateLocation: false,
        retryLiveVideo: false,
      );
}

class ActiveEmergencyLocation {
  const ActiveEmergencyLocation({
    required this.latitude,
    required this.longitude,
    required this.address,
    required this.manualLocationAdjusted,
    required this.source,
    required this.quality,
    required this.liveLocationStale,
    this.liveLocationUpdatedAt,
  });

  final String? latitude;
  final String? longitude;
  final String? address;
  final bool manualLocationAdjusted;
  final String source;
  final String quality;
  final bool liveLocationStale;
  final DateTime? liveLocationUpdatedAt;

  factory ActiveEmergencyLocation.fromJson(Map<String, dynamic> json) {
    return ActiveEmergencyLocation(
      latitude: json["latitude"]?.toString(),
      longitude: json["longitude"]?.toString(),
      address: json["address"]?.toString(),
      manualLocationAdjusted: json["manualLocationAdjusted"] == true,
      source: _requiredString(json, "source", field: "reportedLocation.source"),
      quality: _requiredString(json, "quality", field: "reportedLocation.quality"),
      liveLocationStale: json["liveLocationStale"] == true,
      liveLocationUpdatedAt: _optionalDateTime(json["liveLocationUpdatedAt"]),
    );
  }
}

class ActiveEmergencyEvidenceSummary {
  const ActiveEmergencyEvidenceSummary({
    required this.totalCount,
    required this.photos,
    required this.videos,
    required this.voice,
  });

  final int totalCount;
  final int photos;
  final int videos;
  final int voice;

  factory ActiveEmergencyEvidenceSummary.fromJson(Map<String, dynamic> json) {
    return ActiveEmergencyEvidenceSummary(
      totalCount: _requiredInt(json, "totalCount"),
      photos: _requiredInt(json, "photos"),
      videos: _requiredInt(json, "videos"),
      voice: _requiredInt(json, "voice"),
    );
  }
}

class ActiveEmergencyTimelineEntry {
  const ActiveEmergencyTimelineEntry({
    required this.id,
    required this.eventType,
    required this.message,
    required this.createdAt,
  });

  final String id;
  final String eventType;
  final String message;
  final DateTime createdAt;

  factory ActiveEmergencyTimelineEntry.fromJson(Map<String, dynamic> json) {
    return ActiveEmergencyTimelineEntry(
      id: _requiredString(json, "id", field: "timelineSummary.id"),
      eventType: _requiredString(json, "eventType", field: "timelineSummary.eventType"),
      message: _requiredString(json, "message", field: "timelineSummary.message"),
      createdAt: _requiredDateTime(json["createdAt"], field: "timelineSummary.createdAt"),
    );
  }
}

class ActiveEmergencyAssignment {
  const ActiveEmergencyAssignment({
    required this.id,
    required this.status,
    this.responderDisplayName,
    this.agencyName,
  });

  final String id;
  final String status;
  final String? responderDisplayName;
  final String? agencyName;

  factory ActiveEmergencyAssignment.fromJson(Map<String, dynamic> json) {
    final responder = json["responder"] as Map<String, dynamic>?;
    final agency = json["agency"] as Map<String, dynamic>?;
    return ActiveEmergencyAssignment(
      id: _requiredString(json, "id", field: "assignment.id"),
      status: _requiredString(json, "status", field: "assignment.status"),
      responderDisplayName: responder?["displayName"]?.toString(),
      agencyName: agency?["name"]?.toString(),
    );
  }
}

class ActiveEmergencyLiveVideo {
  const ActiveEmergencyLiveVideo({
    required this.sessionId,
    required this.status,
    this.startedAt,
    this.endedAt,
  });

  final String sessionId;
  final String status;
  final DateTime? startedAt;
  final DateTime? endedAt;

  factory ActiveEmergencyLiveVideo.fromJson(Map<String, dynamic> json) {
    return ActiveEmergencyLiveVideo(
      sessionId: _requiredString(json, "sessionId", field: "liveVideo.sessionId"),
      status: _requiredString(json, "status", field: "liveVideo.status"),
      startedAt: _optionalDateTime(json["startedAt"]),
      endedAt: _optionalDateTime(json["endedAt"]),
    );
  }
}

class ActiveEmergencyCancellationSummary {
  const ActiveEmergencyCancellationSummary({
    required this.status,
    this.reason,
    this.requestedAt,
    this.cancelledAt,
  });

  final String status;
  final String? reason;
  final DateTime? requestedAt;
  final DateTime? cancelledAt;

  factory ActiveEmergencyCancellationSummary.fromJson(Map<String, dynamic> json) {
    return ActiveEmergencyCancellationSummary(
      status: _requiredString(json, "status"),
      reason: json["reason"]?.toString(),
      requestedAt: _optionalDateTime(json["requestedAt"]),
      cancelledAt: _optionalDateTime(json["cancelledAt"]),
    );
  }
}

class ActiveEmergencyResolutionSummary {
  const ActiveEmergencyResolutionSummary({
    this.source,
    this.reason,
    this.resolvedAt,
  });

  final String? source;
  final String? reason;
  final DateTime? resolvedAt;

  factory ActiveEmergencyResolutionSummary.fromJson(Map<String, dynamic> json) {
    return ActiveEmergencyResolutionSummary(
      source: json["source"]?.toString(),
      reason: json["reason"]?.toString(),
      resolvedAt: _optionalDateTime(json["resolvedAt"]),
    );
  }
}

sealed class ActiveEmergencyContract {
  const ActiveEmergencyContract({
    required this.incidentId,
    required this.status,
    required this.displayLabel,
    required this.statusVersion,
    required this.routeType,
    required this.isActive,
  });

  final String incidentId;
  final String status;
  final String displayLabel;
  final int statusVersion;
  final String routeType;
  final bool isActive;

  bool get isTerminal => !isActive;

  factory ActiveEmergencyContract.fromJson(Map<String, dynamic> json) {
    final isActive = json["isActive"];
    if (isActive is! bool) {
      throw ActiveEmergencyContractException(
        ActiveEmergencyErrorCode.malformedContract,
        "Missing required field isActive",
      );
    }
    if (isActive) {
      return ActiveEmergencyActiveContract.fromJson(json);
    }
    return ActiveEmergencyTerminalContract.fromJson(json);
  }
}

class ActiveEmergencyActiveContract extends ActiveEmergencyContract {
  const ActiveEmergencyActiveContract({
    required super.incidentId,
    required super.status,
    required super.displayLabel,
    required super.statusVersion,
    required super.routeType,
    required this.category,
    required this.description,
    required this.title,
    required this.reportedAt,
    required this.reportedLocation,
    required this.evidenceSummary,
    required this.progressStep,
    required this.progressStages,
    required this.allowedActions,
    required this.timelineSummary,
    required this.lastUpdatedAt,
    this.assignedAgencyName,
    this.assignment,
    this.responderEtaMinutes,
    this.liveVideo,
    this.witnessCount,
    this.latestConfidence,
    this.cancellationSummary,
    this.resolutionSummary,
  }) : super(isActive: true);

  final String category;
  final String? description;
  final String title;
  final DateTime reportedAt;
  final ActiveEmergencyLocation reportedLocation;
  final ActiveEmergencyEvidenceSummary evidenceSummary;
  final int progressStep;
  final List<ActiveEmergencyProgressStage> progressStages;
  final ActiveEmergencyAllowedActions allowedActions;
  final List<ActiveEmergencyTimelineEntry> timelineSummary;
  final DateTime lastUpdatedAt;
  final String? assignedAgencyName;
  final ActiveEmergencyAssignment? assignment;
  final int? responderEtaMinutes;
  final ActiveEmergencyLiveVideo? liveVideo;
  final int? witnessCount;
  final String? latestConfidence;
  final ActiveEmergencyCancellationSummary? cancellationSummary;
  final ActiveEmergencyResolutionSummary? resolutionSummary;

  factory ActiveEmergencyActiveContract.fromJson(Map<String, dynamic> json) {
    final progressStagesRaw = json["progressStages"];
    if (progressStagesRaw is! List) {
      throw ActiveEmergencyContractException(
        ActiveEmergencyErrorCode.malformedContract,
        "Missing required field progressStages",
      );
    }
    final timelineRaw = json["timelineSummary"];
    if (timelineRaw is! List) {
      throw ActiveEmergencyContractException(
        ActiveEmergencyErrorCode.malformedContract,
        "Missing required field timelineSummary",
      );
    }

    final assignedAgency = json["assignedAgency"] as Map<String, dynamic>?;
    final assignmentJson = json["assignment"] as Map<String, dynamic>?;
    final liveVideoJson = json["liveVideo"] as Map<String, dynamic>?;
    final community = json["communityVerificationSummary"] as Map<String, dynamic>?;
    final cancellation = json["cancellationSummary"] as Map<String, dynamic>?;
    final resolution = json["resolutionSummary"] as Map<String, dynamic>?;

    return ActiveEmergencyActiveContract(
      incidentId: _requiredString(json, "incidentId"),
      status: _requiredString(json, "status"),
      displayLabel: _requiredString(json, "displayLabel"),
      statusVersion: _requiredInt(json, "statusVersion"),
      routeType: _requiredString(json, "routeType"),
      category: _requiredString(json, "category"),
      description: json["description"]?.toString(),
      title: _requiredString(json, "title"),
      reportedAt: _requiredDateTime(json["reportedAt"], field: "reportedAt"),
      reportedLocation: ActiveEmergencyLocation.fromJson(
        _requiredMap(json, "reportedLocation"),
      ),
      evidenceSummary: ActiveEmergencyEvidenceSummary.fromJson(
        _requiredMap(json, "evidenceSummary"),
      ),
      progressStep: _requiredInt(json, "progressStep"),
      progressStages: progressStagesRaw
          .whereType<Map<String, dynamic>>()
          .map(ActiveEmergencyProgressStage.fromJson)
          .toList(growable: false),
      allowedActions: ActiveEmergencyAllowedActions.fromJson(
        _requiredMap(json, "allowedActions"),
      ),
      timelineSummary: timelineRaw
          .whereType<Map<String, dynamic>>()
          .map(ActiveEmergencyTimelineEntry.fromJson)
          .toList(growable: false),
      lastUpdatedAt: _requiredDateTime(json["lastUpdatedAt"], field: "lastUpdatedAt"),
      assignedAgencyName: assignedAgency?["name"]?.toString(),
      assignment: assignmentJson == null
          ? null
          : ActiveEmergencyAssignment.fromJson(assignmentJson),
      responderEtaMinutes: json["responderEtaMinutes"] == null
          ? null
          : _requiredInt(json, "responderEtaMinutes"),
      liveVideo: liveVideoJson == null
          ? null
          : ActiveEmergencyLiveVideo.fromJson(liveVideoJson),
      witnessCount: community == null ? null : _requiredInt(community, "witnessCount"),
      latestConfidence: community?["latestConfidence"]?.toString(),
      cancellationSummary: cancellation == null
          ? null
          : ActiveEmergencyCancellationSummary.fromJson(cancellation),
      resolutionSummary: resolution == null
          ? null
          : ActiveEmergencyResolutionSummary.fromJson(resolution),
    );
  }
}

class ActiveEmergencyTerminalContract extends ActiveEmergencyContract {
  const ActiveEmergencyTerminalContract({
    required super.incidentId,
    required super.status,
    required super.displayLabel,
    required super.statusVersion,
    required super.routeType,
    this.cancellationSummary,
    this.resolutionSummary,
  }) : super(isActive: false);

  final ActiveEmergencyCancellationSummary? cancellationSummary;
  final ActiveEmergencyResolutionSummary? resolutionSummary;

  factory ActiveEmergencyTerminalContract.fromJson(Map<String, dynamic> json) {
    final cancellation = json["cancellationSummary"] as Map<String, dynamic>?;
    final resolution = json["resolutionSummary"] as Map<String, dynamic>?;
    return ActiveEmergencyTerminalContract(
      incidentId: _requiredString(json, "incidentId"),
      status: _requiredString(json, "status"),
      displayLabel: _requiredString(json, "displayLabel"),
      statusVersion: _requiredInt(json, "statusVersion"),
      routeType: _requiredString(json, "routeType"),
      cancellationSummary: cancellation == null
          ? null
          : ActiveEmergencyCancellationSummary.fromJson(cancellation),
      resolutionSummary: resolution == null
          ? null
          : ActiveEmergencyResolutionSummary.fromJson(resolution),
    );
  }
}

String _requiredString(Map<String, dynamic> json, String key, {String? field}) {
  final value = json[key];
  if (value == null || value.toString().trim().isEmpty) {
    throw ActiveEmergencyContractException(
      ActiveEmergencyErrorCode.malformedContract,
      "Missing required field ${field ?? key}",
    );
  }
  return value.toString();
}

Map<String, dynamic> _requiredMap(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! Map<String, dynamic>) {
    throw ActiveEmergencyContractException(
      ActiveEmergencyErrorCode.malformedContract,
      "Missing required object $key",
    );
  }
  return value;
}

int _requiredInt(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is int) return value;
  if (value is num) return value.toInt();
  throw ActiveEmergencyContractException(
    ActiveEmergencyErrorCode.malformedContract,
    "Missing required integer $key",
  );
}

bool _requiredBool(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is bool) return value;
  throw ActiveEmergencyContractException(
    ActiveEmergencyErrorCode.malformedContract,
    "Missing required boolean $key",
  );
}

DateTime _requiredDateTime(Object? value, {required String field}) {
  final parsed = _optionalDateTime(value);
  if (parsed == null) {
    throw ActiveEmergencyContractException(
      ActiveEmergencyErrorCode.malformedContract,
      "Missing required datetime $field",
    );
  }
  return parsed;
}

DateTime? _optionalDateTime(Object? value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}
