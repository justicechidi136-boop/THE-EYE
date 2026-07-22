import "dart:convert";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "../incidents/incident_submission_service.dart";

class InboxNotificationItem {
  const InboxNotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.priority,
    required this.deliveryStatus,
    required this.read,
    required this.createdAt,
    this.deepLink,
    this.incidentId,
    this.broadcastId,
    this.expired = false,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final String priority;
  final String deliveryStatus;
  final bool read;
  final DateTime createdAt;
  final String? deepLink;
  final String? incidentId;
  final String? broadcastId;
  final bool expired;

  String get area => body;
  String get delivery => deliveryStatus;
  DateTime get receivedAt => createdAt;

  factory InboxNotificationItem.fromJson(Map<String, dynamic> json) {
    return InboxNotificationItem(
      id: (json["id"] as String?) ?? "",
      type: (json["type"] as String?) ?? "IncidentStatusUpdate",
      title: (json["title"] as String?) ?? "",
      body: (json["body"] as String?) ?? "",
      priority: (json["priority"] as String?) ?? "Normal",
      deliveryStatus: (json["deliveryStatus"] as String?) ??
          (json["status"] as String?) ??
          "Created",
      read: json["read"] == true || json["readAt"] != null,
      createdAt: DateTime.tryParse((json["createdAt"] as String?) ?? "") ??
          DateTime.now(),
      deepLink: json["deepLink"] as String?,
      incidentId: json["incidentId"] as String?,
      broadcastId: json["broadcastId"] as String?,
      expired: json["expired"] == true,
    );
  }

  InboxNotificationItem copyWith({bool? read, String? deliveryStatus}) {
    return InboxNotificationItem(
      id: id,
      type: type,
      title: title,
      body: body,
      priority: priority,
      deliveryStatus: deliveryStatus ?? this.deliveryStatus,
      read: read ?? this.read,
      createdAt: createdAt,
      deepLink: deepLink,
      incidentId: incidentId,
      broadcastId: broadcastId,
      expired: expired,
    );
  }
}

class NotificationInboxPage {
  const NotificationInboxPage({
    required this.items,
    this.nextCursor,
    this.unreadCount = 0,
  });

  final List<InboxNotificationItem> items;
  final String? nextCursor;
  final int unreadCount;
}

class NotificationInboxService {
  NotificationInboxService({TheEyeApiClient? apiClient})
      : _apiClient = apiClient ??
            TheEyeApiClient(baseUrl: TheEyeApiPaths.defaultBaseUrl);

  final TheEyeApiClient _apiClient;

  Future<NotificationInboxPage> list({
    required String accessToken,
    String? cursor,
    int limit = 25,
    bool unreadOnly = false,
    String? category,
    String? severity,
  }) async {
    final query = <String, String>{
      "limit": "$limit",
      if (cursor != null) "cursor": cursor,
      if (unreadOnly) "unreadOnly": "true",
      if (category != null && category.isNotEmpty) "category": category,
      if (severity != null && severity.isNotEmpty) "severity": severity,
    };
    final response = await _apiClient.getJson(
      TheEyeApiPaths.notifications,
      accessToken: accessToken,
      query: query,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    if (decoded is! Map) {
      throw IncidentApiException(
          response.statusCode, "Unexpected notification list response.");
    }
    final rows = decoded["data"];
    final items = rows is List
        ? rows
            .whereType<Map>()
            .map((row) =>
                InboxNotificationItem.fromJson(Map<String, dynamic>.from(row)))
            .where((item) => !item.expired)
            .toList()
        : <InboxNotificationItem>[];
    final meta = decoded["meta"];
    final unreadCount =
        meta is Map ? (meta["unreadCount"] as num?)?.toInt() ?? 0 : 0;
    return NotificationInboxPage(
      items: items,
      nextCursor: decoded["nextCursor"] as String?,
      unreadCount: unreadCount,
    );
  }

  Future<InboxNotificationItem> getById({
    required String accessToken,
    required String notificationId,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.notificationDetail(notificationId),
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    if (decoded is! Map || decoded["data"] is! Map) {
      throw IncidentApiException(
          response.statusCode, "Unexpected notification detail response.");
    }
    return InboxNotificationItem.fromJson(
        Map<String, dynamic>.from(decoded["data"] as Map));
  }

  Future<int> unreadCount({required String accessToken}) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.notificationsUnreadCount,
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    if (decoded is! Map) return 0;
    return (decoded["unreadCount"] as num?)?.toInt() ?? 0;
  }

  Future<void> markRead({
    required String accessToken,
    required String notificationId,
  }) async {
    final response = await _apiClient.patchJson(
      TheEyeApiPaths.notificationRead(notificationId),
      const {},
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
  }

  Future<void> markAllRead({required String accessToken}) async {
    final response = await _apiClient.patchJson(
      TheEyeApiPaths.notificationsReadAll,
      const {},
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
  }
}
