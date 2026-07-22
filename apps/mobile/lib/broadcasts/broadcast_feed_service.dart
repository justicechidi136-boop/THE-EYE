import "dart:convert";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "../incidents/incident_submission_service.dart";

class BroadcastFeedItem {
  const BroadcastFeedItem({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.priority,
    required this.read,
    required this.publishedAt,
    this.expiresAt,
    this.expired = false,
    this.distanceMeters,
    this.deepLink,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final String priority;
  final bool read;
  final DateTime? publishedAt;
  final DateTime? expiresAt;
  final bool expired;
  final double? distanceMeters;
  final String? deepLink;

  factory BroadcastFeedItem.fromJson(Map<String, dynamic> json) {
    return BroadcastFeedItem(
      id: (json["id"] as String?) ?? "",
      type: (json["type"] as String?) ?? "Emergency",
      title: (json["title"] as String?) ?? "",
      body: (json["body"] as String?) ?? "",
      priority: (json["priority"] as String?) ?? "P4GeneralSafety",
      read: json["read"] == true,
      publishedAt: DateTime.tryParse((json["publishedAt"] as String?) ?? ""),
      expiresAt: DateTime.tryParse((json["expiresAt"] as String?) ?? ""),
      expired: json["expired"] == true,
      distanceMeters: json["distanceMeters"] == null
          ? null
          : double.tryParse("${json["distanceMeters"]}"),
      deepLink: json["deepLink"] as String?,
    );
  }

  BroadcastFeedItem copyWith({bool? read}) {
    return BroadcastFeedItem(
      id: id,
      type: type,
      title: title,
      body: body,
      priority: priority,
      read: read ?? this.read,
      publishedAt: publishedAt,
      expiresAt: expiresAt,
      expired: expired,
      distanceMeters: distanceMeters,
      deepLink: deepLink,
    );
  }
}

class BroadcastFeedPage {
  const BroadcastFeedPage({
    required this.items,
    this.nextCursor,
    this.unreadCount = 0,
  });

  final List<BroadcastFeedItem> items;
  final String? nextCursor;
  final int unreadCount;
}

class BroadcastFeedService {
  BroadcastFeedService({TheEyeApiClient? apiClient})
      : _apiClient = apiClient ??
            TheEyeApiClient(baseUrl: TheEyeApiPaths.defaultBaseUrl);

  final TheEyeApiClient _apiClient;

  Future<BroadcastFeedPage> listNearby({
    required String accessToken,
    required double latitude,
    required double longitude,
    String? cursor,
    int limit = 25,
    bool unreadOnly = false,
    String? category,
    String? severity,
  }) async {
    final query = <String, String>{
      "latitude": "$latitude",
      "longitude": "$longitude",
      "limit": "$limit",
      if (cursor != null) "cursor": cursor,
      if (unreadOnly) "unreadOnly": "true",
      if (category != null && category.isNotEmpty) "category": category,
      if (severity != null && severity.isNotEmpty) "severity": severity,
    };
    final response = await _apiClient.getJson(
      TheEyeApiPaths.broadcastsNearby,
      accessToken: accessToken,
      query: query,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    final rows = decoded is Map && decoded["data"] is List
        ? decoded["data"] as List
        : decoded is List
            ? decoded
            : const [];
    final items = rows
        .whereType<Map>()
        .map(
            (row) => BroadcastFeedItem.fromJson(Map<String, dynamic>.from(row)))
        .toList();
    return BroadcastFeedPage(
      items: items,
      nextCursor: decoded is Map ? decoded["nextCursor"] as String? : null,
    );
  }

  Future<BroadcastFeedItem> getDetail({
    required String accessToken,
    required String broadcastId,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.broadcastDetail(broadcastId),
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    final row = decoded is Map && decoded["data"] is Map
        ? Map<String, dynamic>.from(decoded["data"] as Map)
        : Map<String, dynamic>.from(decoded as Map);
    return BroadcastFeedItem.fromJson(row);
  }

  Future<int> unreadCount({required String accessToken}) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.broadcastsUnreadCount,
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    return decoded is Map ? (decoded["unreadCount"] as num?)?.toInt() ?? 0 : 0;
  }

  Future<void> markRead({
    required String accessToken,
    required String broadcastId,
  }) async {
    final response = await _apiClient.patchJson(
      TheEyeApiPaths.broadcastRead(broadcastId),
      const {},
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
  }
}
