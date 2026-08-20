/// Strict mobile contract for `GET /v1/incidents/:incidentId/active-emergency`.
library;

import "active_emergency_errors.dart";
import "incident_communication_contract.dart";

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
    final stateRaw =
        _requiredString(json, "state", field: "progressStages.state");
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
    required this.uploadPhoto,
    required this.uploadVideo,
    required this.uploadVoice,
    required this.addUpdate,
    required this.cancel,
    required this.requestCancellation,
    required this.confirmResolved,
    required this.confirmStillOngoing,
    required this.addWrittenUpdate,
    required this.updateLocation,
    required this.retryLiveVideo,
  });

  final bool addEvidence;
  final bool uploadPhoto;
  final bool uploadVideo;
  final bool uploadVoice;
  final bool addUpdate;
  final bool cancel;
  final bool requestCancellation;
  final bool confirmResolved;
  final bool confirmStillOngoing;
  final bool addWrittenUpdate;
  final bool updateLocation;
  final bool retryLiveVideo;

  factory ActiveEmergencyAllowedActions.fromJson(Map<String, dynamic> json) {
    final addEvidence = _requiredBool(json, "addEvidence");
    return ActiveEmergencyAllowedActions(
      addEvidence: addEvidence,
      uploadPhoto: _optionalBool(json, "uploadPhoto", addEvidence),
      uploadVideo: _optionalBool(json, "uploadVideo", addEvidence),
      uploadVoice: _optionalBool(json, "uploadVoice", addEvidence),
      addUpdate: _optionalBool(json, "addUpdate",
          _optionalBool(json, "addWrittenUpdate", addEvidence)),
      cancel: _requiredBool(json, "cancel"),
      requestCancellation: _requiredBool(json, "requestCancellation"),
      confirmResolved: _requiredBool(json, "confirmResolved"),
      confirmStillOngoing: _requiredBool(json, "confirmStillOngoing"),
      addWrittenUpdate: _optionalBool(json, "addWrittenUpdate", addEvidence),
      updateLocation: _requiredBool(json, "updateLocation"),
      retryLiveVideo: _requiredBool(json, "retryLiveVideo"),
    );
  }

  static ActiveEmergencyAllowedActions empty() =>
      const ActiveEmergencyAllowedActions(
        addEvidence: false,
        uploadPhoto: false,
        uploadVideo: false,
        uploadVoice: false,
        addUpdate: false,
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
    this.locationLabel,
  });

  final String? latitude;
  final String? longitude;
  final String? address;
  final bool manualLocationAdjusted;
  final String source;
  final String quality;
  final bool liveLocationStale;
  final DateTime? liveLocationUpdatedAt;
  final String? locationLabel;

  factory ActiveEmergencyLocation.fromJson(Map<String, dynamic> json) {
    return ActiveEmergencyLocation(
      latitude: json["latitude"]?.toString(),
      longitude: json["longitude"]?.toString(),
      address: json["address"]?.toString(),
      manualLocationAdjusted: json["manualLocationAdjusted"] == true,
      source: _requiredString(json, "source", field: "reportedLocation.source"),
      quality:
          _requiredString(json, "quality", field: "reportedLocation.quality"),
      liveLocationStale: json["liveLocationStale"] == true,
      liveLocationUpdatedAt: _optionalDateTime(json["liveLocationUpdatedAt"]),
      locationLabel: json["locationLabel"]?.toString(),
    );
  }
}

class ActiveEmergencyEvidenceItem {
  const ActiveEmergencyEvidenceItem({
    required this.id,
    required this.mediaType,
    required this.uploadedAt,
    this.durationSeconds,
  });

  final String id;
  final String mediaType;
  final DateTime uploadedAt;
  final int? durationSeconds;

  factory ActiveEmergencyEvidenceItem.fromJson(Map<String, dynamic> json) {
    return ActiveEmergencyEvidenceItem(
      id: _requiredString(json, "id", field: "evidenceItems.id"),
      mediaType:
          _requiredString(json, "mediaType", field: "evidenceItems.mediaType"),
      uploadedAt: _requiredDateTime(json["uploadedAt"],
          field: "evidenceItems.uploadedAt"),
      durationSeconds: json["durationSeconds"] == null
          ? null
          : _requiredInt(json, "durationSeconds"),
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
      eventType: _requiredString(json, "eventType",
          field: "timelineSummary.eventType"),
      message:
          _requiredString(json, "message", field: "timelineSummary.message"),
      createdAt: _requiredDateTime(json["createdAt"],
          field: "timelineSummary.createdAt"),
    );
  }
}

class ActiveEmergencyAssignment {
  const ActiveEmergencyAssignment({
    required this.id,
    required this.status,
    this.responderDisplayName,
    this.agencyName,
    this.statusLabel,
  });

  final String id;
  final String status;
  final String? responderDisplayName;
  final String? agencyName;
  final String? statusLabel;

  factory ActiveEmergencyAssignment.fromJson(Map<String, dynamic> json) {
    final responder = json["responder"] as Map<String, dynamic>?;
    final agency = json["agency"] as Map<String, dynamic>?;
    return ActiveEmergencyAssignment(
      id: _requiredString(json, "id", field: "assignment.id"),
      status: _requiredString(json, "status", field: "assignment.status"),
      responderDisplayName: responder?["displayName"]?.toString(),
      agencyName: agency?["name"]?.toString(),
      statusLabel: json["statusLabel"]?.toString(),
    );
  }
}

class ActiveEmergencyLiveVideo {
  const ActiveEmergencyLiveVideo({
    required this.sessionId,
    required this.status,
    required this.displayState,
    this.startedAt,
    this.endedAt,
    this.durationSeconds,
    this.connectionStatus,
    this.participantCount,
    this.retryAvailable = false,
  });

  final String? sessionId;
  final String status;
  final String displayState;
  final DateTime? startedAt;
  final DateTime? endedAt;
  final int? durationSeconds;
  final String? connectionStatus;
  final int? participantCount;
  final bool retryAvailable;

  factory ActiveEmergencyLiveVideo.fromJson(Map<String, dynamic> json) {
    return ActiveEmergencyLiveVideo(
      sessionId: json["sessionId"]?.toString(),
      status: _requiredString(json, "status", field: "liveVideo.status"),
      displayState: json["displayState"]?.toString() ??
          json["status"]?.toString() ??
          "NotStarted",
      startedAt: _optionalDateTime(json["startedAt"]),
      endedAt: _optionalDateTime(json["endedAt"]),
      durationSeconds: json["durationSeconds"] == null
          ? null
          : _requiredInt(json, "durationSeconds"),
      connectionStatus: json["connectionStatus"]?.toString(),
      participantCount: json["participantCount"] == null
          ? null
          : _requiredInt(json, "participantCount"),
      retryAvailable: json["retryAvailable"] == true,
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

  factory ActiveEmergencyCancellationSummary.fromJson(
      Map<String, dynamic> json) {
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
    this.publicReference,
  });

  final String incidentId;
  final String status;
  final String displayLabel;
  final int statusVersion;
  final String routeType;
  final bool isActive;
  final String? publicReference;

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
    this.reporterConfidence,
    this.communication = const IncidentCommunicationSummary(
      conversationAvailable: false,
      unreadMessageCount: 0,
      conversationStatus: "Active",
      allowedCommunicationActions: IncidentCommunicationAllowedActions(
        sendText: false,
        sendVoice: false,
        sendPhoto: false,
        sendVideo: false,
        sendLocation: false,
        quickReply: false,
        openThread: false,
      ),
    ),
    super.publicReference,
    this.categoryLabel,
    this.evidenceItems = const [],
    this.witnessSummary,
  }) : super(isActive: true);

  final String category;
  final String? categoryLabel;
  final String? description;
  final String title;
  final DateTime reportedAt;
  final ActiveEmergencyLocation reportedLocation;
  final ActiveEmergencyEvidenceSummary evidenceSummary;
  final List<ActiveEmergencyEvidenceItem> evidenceItems;
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
  final String? witnessSummary;
  final ActiveEmergencyCancellationSummary? cancellationSummary;
  final ActiveEmergencyResolutionSummary? resolutionSummary;
  final String? reporterConfidence;
  final IncidentCommunicationSummary communication;

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
    final community =
        json["communityVerificationSummary"] as Map<String, dynamic>?;
    final cancellation = json["cancellationSummary"] as Map<String, dynamic>?;
    final resolution = json["resolutionSummary"] as Map<String, dynamic>?;
    final evidenceItemsRaw = json["evidenceItems"];
    if (evidenceItemsRaw is! List) {
      throw ActiveEmergencyContractException(
        ActiveEmergencyErrorCode.malformedContract,
        "Missing required field evidenceItems",
      );
    }
    final evidenceItems = <ActiveEmergencyEvidenceItem>[];
    for (final item in evidenceItemsRaw) {
      if (item is! Map<String, dynamic>) {
        throw ActiveEmergencyContractException(
          ActiveEmergencyErrorCode.malformedContract,
          "Invalid evidenceItems entry",
        );
      }
      evidenceItems.add(ActiveEmergencyEvidenceItem.fromJson(item));
    }
    final evidenceSummary = ActiveEmergencyEvidenceSummary.fromJson(
      _requiredMap(json, "evidenceSummary"),
    );
    final imageCount =
        evidenceItems.where((item) => item.mediaType == "Image").length;
    final videoCount =
        evidenceItems.where((item) => item.mediaType == "Video").length;
    final audioCount =
        evidenceItems.where((item) => item.mediaType == "Audio").length;
    if (evidenceSummary.totalCount != evidenceItems.length ||
        evidenceSummary.photos != imageCount ||
        evidenceSummary.videos != videoCount ||
        evidenceSummary.voice != audioCount) {
      throw ActiveEmergencyContractException(
        ActiveEmergencyErrorCode.malformedContract,
        "Evidence summary does not match evidence items",
      );
    }

    return ActiveEmergencyActiveContract(
      incidentId: _requiredString(json, "incidentId"),
      publicReference: json["publicReference"]?.toString(),
      status: _requiredString(json, "status"),
      displayLabel: _requiredString(json, "displayLabel"),
      statusVersion: _requiredInt(json, "statusVersion"),
      routeType: _requiredString(json, "routeType"),
      category: _requiredString(json, "category"),
      categoryLabel: json["categoryLabel"]?.toString(),
      description: json["description"]?.toString(),
      title: _requiredString(json, "title"),
      reportedAt: _requiredDateTime(json["reportedAt"], field: "reportedAt"),
      reportedLocation: ActiveEmergencyLocation.fromJson(
        _requiredMap(json, "reportedLocation"),
      ),
      evidenceSummary: evidenceSummary,
      evidenceItems: List.unmodifiable(evidenceItems),
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
      lastUpdatedAt:
          _requiredDateTime(json["lastUpdatedAt"], field: "lastUpdatedAt"),
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
      witnessCount:
          community == null ? null : _requiredInt(community, "witnessCount"),
      latestConfidence: community?["latestConfidence"]?.toString(),
      witnessSummary: community?["witnessSummary"]?.toString(),
      cancellationSummary: cancellation == null
          ? null
          : ActiveEmergencyCancellationSummary.fromJson(cancellation),
      resolutionSummary: resolution == null
          ? null
          : ActiveEmergencyResolutionSummary.fromJson(resolution),
      reporterConfidence: json["reporterConfidence"]?.toString(),
      communication: IncidentCommunicationSummary.fromJson(
        json["communication"] as Map<String, dynamic>?,
      ),
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
    this.communication = const IncidentCommunicationSummary(
      conversationAvailable: false,
      unreadMessageCount: 0,
      conversationStatus: "Closed",
      allowedCommunicationActions: IncidentCommunicationAllowedActions(
        sendText: false,
        sendVoice: false,
        sendPhoto: false,
        sendVideo: false,
        sendLocation: false,
        quickReply: false,
        openThread: false,
      ),
    ),
  }) : super(isActive: false);

  final ActiveEmergencyCancellationSummary? cancellationSummary;
  final ActiveEmergencyResolutionSummary? resolutionSummary;
  final IncidentCommunicationSummary communication;

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
      communication: IncidentCommunicationSummary.fromJson(
        json["communication"] as Map<String, dynamic>?,
      ),
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

bool _optionalBool(Map<String, dynamic> json, String key, bool fallback) {
  final value = json[key];
  if (value is bool) return value;
  return fallback;
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
