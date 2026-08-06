import "dart:convert";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "../incidents/incident_submission_service.dart";

class ActivityTimelineEntry {
  const ActivityTimelineEntry({
    required this.label,
    required this.at,
    required this.type,
  });

  final String label;
  final String at;
  final String type;

  factory ActivityTimelineEntry.fromJson(Map<String, dynamic> json) {
    return ActivityTimelineEntry(
      label: json["label"]?.toString() ?? "Update",
      at: json["at"]?.toString() ?? "",
      type: json["type"]?.toString() ?? "update",
    );
  }
}

class ActivityNavigationTarget {
  const ActivityNavigationTarget({
    required this.destination,
    this.incidentId,
    this.broadcastId,
  });

  final String destination;
  final String? incidentId;
  final String? broadcastId;

  factory ActivityNavigationTarget.fromJson(Map<String, dynamic>? json) {
    final map = json ?? const {};
    return ActivityNavigationTarget(
      destination: map["destination"]?.toString() ?? "incident-archive",
      incidentId: map["incidentId"]?.toString(),
      broadcastId: map["broadcastId"]?.toString(),
    );
  }
}

class ActivityHistoryItem {
  const ActivityHistoryItem({
    required this.sourceType,
    required this.kind,
    required this.id,
    required this.category,
    required this.status,
    required this.lifecycle,
    required this.statusBadge,
    required this.occurredAt,
    required this.dateLabel,
    required this.timeLabel,
    required this.verificationStatus,
    required this.unreadUpdatesCount,
    required this.timelinePreview,
    required this.navigation,
    required this.isActive,
    required this.isTerminal,
    required this.title,
    this.locationAddress,
    this.agency,
    this.verificationConfidence,
    this.broadcastReach,
    this.latestUpdateLabel,
    this.latestUpdateAt,
    this.thumbnailMediaType,
    this.missingPersonName,
    this.vehiclePlate,
  });

  final String sourceType;
  final String kind;
  final String id;
  final String category;
  final String status;
  final String lifecycle;
  final String statusBadge;
  final String occurredAt;
  final String dateLabel;
  final String timeLabel;
  final String? locationAddress;
  final String? agency;
  final int? verificationConfidence;
  final String verificationStatus;
  final int? broadcastReach;
  final String? latestUpdateLabel;
  final String? latestUpdateAt;
  final int unreadUpdatesCount;
  final String? thumbnailMediaType;
  final List<ActivityTimelineEntry> timelinePreview;
  final ActivityNavigationTarget navigation;
  final bool isActive;
  final bool isTerminal;
  final String title;
  final String? missingPersonName;
  final String? vehiclePlate;

  factory ActivityHistoryItem.fromJson(Map<String, dynamic> json) {
    final preview = <ActivityTimelineEntry>[];
    final rawPreview = json["timelinePreview"];
    if (rawPreview is List) {
      for (final entry in rawPreview) {
        if (entry is Map) {
          preview.add(ActivityTimelineEntry.fromJson(Map<String, dynamic>.from(entry)));
        }
      }
    }
    final latest = json["latestUpdate"];
    final latestMap = latest is Map ? Map<String, dynamic>.from(latest) : null;
    final thumbnail = json["thumbnail"];
    final thumbnailMap = thumbnail is Map ? Map<String, dynamic>.from(thumbnail) : null;
    final location = json["location"];
    final locationMap = location is Map ? Map<String, dynamic>.from(location) : null;
    return ActivityHistoryItem(
      sourceType: json["sourceType"]?.toString() ?? "incident",
      kind: json["kind"]?.toString() ?? "EmergencyReport",
      id: json["id"]?.toString() ?? "",
      category: json["category"]?.toString() ?? "Incident",
      status: json["status"]?.toString() ?? "",
      lifecycle: json["lifecycle"]?.toString() ?? "active",
      statusBadge: json["statusBadge"]?.toString() ?? json["status"]?.toString() ?? "",
      occurredAt: json["occurredAt"]?.toString() ?? "",
      dateLabel: json["dateLabel"]?.toString() ?? "",
      timeLabel: json["timeLabel"]?.toString() ?? "",
      locationAddress: locationMap?["address"]?.toString(),
      agency: json["agency"]?.toString(),
      verificationConfidence: json["verificationConfidence"] is num
          ? (json["verificationConfidence"] as num).round()
          : null,
      verificationStatus: json["verificationStatus"]?.toString() ?? "Pending",
      broadcastReach: json["broadcastReach"] is num ? (json["broadcastReach"] as num).round() : null,
      latestUpdateLabel: latestMap?["label"]?.toString(),
      latestUpdateAt: latestMap?["at"]?.toString(),
      unreadUpdatesCount: json["unreadUpdatesCount"] is num ? (json["unreadUpdatesCount"] as num).round() : 0,
      thumbnailMediaType: thumbnailMap?["mediaType"]?.toString(),
      timelinePreview: preview,
      navigation: ActivityNavigationTarget.fromJson(
        json["navigation"] is Map ? Map<String, dynamic>.from(json["navigation"] as Map) : null,
      ),
      isActive: json["isActive"] == true,
      isTerminal: json["isTerminal"] == true,
      title: json["title"]?.toString() ?? json["category"]?.toString() ?? "Activity",
      missingPersonName: json["missingPersonName"]?.toString(),
      vehiclePlate: json["vehiclePlate"]?.toString(),
    );
  }
}

class ActivityHistoryPage {
  const ActivityHistoryPage({
    required this.items,
    required this.hasMore,
    this.nextCursor,
  });

  final List<ActivityHistoryItem> items;
  final bool hasMore;
  final String? nextCursor;
}

class ActivityHistoryService {
  ActivityHistoryService({TheEyeApiClient? apiClient})
      : _apiClient = apiClient ?? TheEyeApiClient();

  final TheEyeApiClient _apiClient;

  Future<ActivityHistoryPage> listActivityHistory({
    required String accessToken,
    String section = "All",
    String? query,
    String? cursor,
    int limit = 25,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.usersMeActivityHistory,
      accessToken: accessToken,
      query: {
        "section": section,
        if (query != null && query.isNotEmpty) "q": query,
        if (cursor != null && cursor.isNotEmpty) "cursor": cursor,
        "limit": "$limit",
      },
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    if (decoded is! Map) {
      throw IncidentApiException(response.statusCode, "Unexpected activity history response.");
    }
    final map = Map<String, dynamic>.from(decoded);
    final rows = map["data"];
    final items = <ActivityHistoryItem>[];
    if (rows is List) {
      for (final row in rows) {
        if (row is Map) {
          items.add(ActivityHistoryItem.fromJson(Map<String, dynamic>.from(row)));
        }
      }
    }
    return ActivityHistoryPage(
      items: items,
      hasMore: map["hasMore"] == true,
      nextCursor: map["nextCursor"]?.toString(),
    );
  }

  Future<Map<String, dynamic>> getIncidentArchive({
    required String accessToken,
    required String incidentId,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.incidentArchive(incidentId),
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    if (decoded is! Map || decoded["data"] is! Map) {
      throw IncidentApiException(response.statusCode, "Unexpected incident archive response.");
    }
    return Map<String, dynamic>.from(decoded["data"] as Map);
  }

  Future<Map<String, dynamic>> getBroadcastArchive({
    required String accessToken,
    required String broadcastId,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.broadcastArchive(broadcastId),
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    if (decoded is! Map || decoded["data"] is! Map) {
      throw IncidentApiException(response.statusCode, "Unexpected broadcast archive response.");
    }
    return Map<String, dynamic>.from(decoded["data"] as Map);
  }
}
