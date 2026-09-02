import "dart:convert";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "../incidents/incident_submission_service.dart";
import "broadcast_public_share.dart";

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
    this.status = "Active",
    this.authorLabel,
    this.adminVerified = false,
    this.country,
    this.state,
    this.commentsCount = 0,
    this.creatorUserId,
    this.metadata = const {},
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
  final String status;
  final String? authorLabel;
  final bool adminVerified;
  final String? country;
  final String? state;
  final int commentsCount;
  final String? creatorUserId;
  final Map<String, dynamic> metadata;

  factory BroadcastFeedItem.fromJson(Map<String, dynamic> json) {
    final rawMetadata = json["metadata"];
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
      status: (json["status"] as String?) ?? "Active",
      authorLabel: json["authorLabel"] as String?,
      adminVerified: json["adminVerified"] == true,
      country: json["country"] as String?,
      state: json["state"] as String?,
      commentsCount: (json["commentsCount"] as num?)?.toInt() ?? 0,
      creatorUserId: json["creatorUserId"] as String?,
      metadata: rawMetadata is Map
          ? Map<String, dynamic>.from(rawMetadata)
          : const {},
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
      status: status,
      authorLabel: authorLabel,
      adminVerified: adminVerified,
      country: country,
      state: state,
      commentsCount: commentsCount,
      creatorUserId: creatorUserId,
      metadata: metadata,
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

class BroadcastCommentItem {
  const BroadcastCommentItem({
    required this.id,
    required this.body,
    required this.createdAt,
    this.updatedAt,
    this.parentId,
    this.authorUserId,
    this.authorName = "Citizen",
    this.helpfulReactions = 0,
    this.thanksReactions = 0,
    this.isSighting = false,
    this.isPinned = false,
    this.voiceNoteUrl,
    this.voiceNoteDurationSeconds,
  });

  final String id;
  final String body;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final String? parentId;
  final String? authorUserId;
  final String authorName;
  final int helpfulReactions;
  final int thanksReactions;
  final bool isSighting;
  final bool isPinned;
  final String? voiceNoteUrl;
  final int? voiceNoteDurationSeconds;

  factory BroadcastCommentItem.fromJson(Map<String, dynamic> json) {
    final metadata = json["metadata"];
    final isSighting = metadata is Map && metadata["isSighting"] == true;
    final voiceNote = json["voiceNote"];
    return BroadcastCommentItem(
      id: (json["id"] as String?) ?? "",
      body: (json["body"] as String?) ?? "",
      createdAt: DateTime.tryParse((json["createdAt"] as String?) ?? ""),
      updatedAt: DateTime.tryParse((json["updatedAt"] as String?) ?? ""),
      parentId: json["parentId"] as String?,
      authorUserId: json["authorUserId"] as String?,
      authorName: (json["authorName"] as String?)?.trim().isNotEmpty == true
          ? json["authorName"] as String
          : "Citizen",
      helpfulReactions:
          ((json["reactions"] as Map?)?["Helpful"] as num?)?.toInt() ?? 0,
      thanksReactions:
          ((json["reactions"] as Map?)?["Thanks"] as num?)?.toInt() ?? 0,
      isSighting: isSighting || json["isSighting"] == true,
      isPinned: json["isPinned"] == true,
      voiceNoteUrl: voiceNote is Map ? voiceNote["url"] as String? : null,
      voiceNoteDurationSeconds: voiceNote is Map
          ? (voiceNote["durationSeconds"] as num?)?.toInt()
          : null,
    );
  }
}

class BroadcastSharePayload {
  const BroadcastSharePayload({
    required this.title,
    required this.body,
    required this.shareText,
    this.deepLink,
    this.locallyGenerated = false,
  });

  final String title;
  final String body;
  final String shareText;
  final String? deepLink;
  final bool locallyGenerated;

  factory BroadcastSharePayload.fromPublic(
      BroadcastPublicSharePayload payload) {
    return BroadcastSharePayload(
      title: payload.title,
      body: payload.summary,
      shareText: payload.shareText,
      deepLink: payload.deepLink,
      locallyGenerated: payload.locallyGenerated,
    );
  }

  factory BroadcastSharePayload.fromJson(Map<String, dynamic> json) {
    return BroadcastSharePayload.fromPublic(
      BroadcastPublicSharePayload.fromApiJson(json),
    );
  }
}

class BroadcastFeedService {
  BroadcastFeedService({TheEyeApiClient? apiClient})
      : _apiClient = apiClient ?? TheEyeApiClient();

  final TheEyeApiClient _apiClient;

  Future<BroadcastFeedPage> listCountryWide({
    required String accessToken,
    String? cursor,
    int limit = 25,
    bool unreadOnly = false,
    String? category,
    String? severity,
    String? status,
    bool nearMe = false,
    double? latitude,
    double? longitude,
  }) async {
    final query = <String, String>{
      "limit": "$limit",
      if (cursor != null) "cursor": cursor,
      if (unreadOnly) "unreadOnly": "true",
      if (category != null && category.isNotEmpty) "category": category,
      if (severity != null && severity.isNotEmpty) "severity": severity,
      if (status != null && status.isNotEmpty) "status": status,
      if (nearMe) "nearMe": "true",
      if (nearMe && latitude != null) "latitude": "$latitude",
      if (nearMe && longitude != null) "longitude": "$longitude",
    };
    final response = await _apiClient.getJson(
      TheEyeApiPaths.broadcastsCountry,
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

  Future<List<BroadcastFeedItem>> listMine({
    required String accessToken,
    String? status,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.broadcastsMine,
      accessToken: accessToken,
      query: {
        if (status != null && status.isNotEmpty && status != "All")
          "status": status,
      },
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
    return rows
        .whereType<Map>()
        .map(
          (row) => BroadcastFeedItem.fromJson(Map<String, dynamic>.from(row)),
        )
        .toList();
  }

  Future<List<BroadcastCommentItem>> listComments({
    required String accessToken,
    required String broadcastId,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.broadcastComments(broadcastId),
      accessToken: accessToken,
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
    return rows
        .whereType<Map>()
        .map(
          (row) =>
              BroadcastCommentItem.fromJson(Map<String, dynamic>.from(row)),
        )
        .toList();
  }

  Future<BroadcastPublicSharePayload> getPublicSharePayload({
    required String accessToken,
    required String broadcastId,
    BroadcastFeedItem? fallbackSource,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.broadcastShare(broadcastId),
      accessToken: accessToken,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = jsonDecode(response.body);
      if (decoded is Map) {
        return BroadcastPublicSharePayload.fromApiJson(
          Map<String, dynamic>.from(decoded),
        );
      }
    }

    if (fallbackSource != null &&
        (response.statusCode == 404 ||
            response.statusCode == 501 ||
            response.statusCode == 502 ||
            response.statusCode == 503 ||
            response.statusCode >= 500)) {
      return BroadcastPublicShareMapper.fromFeedItemFallback(fallbackSource);
    }

    throw IncidentApiException.fromResponse(response);
  }

  Future<BroadcastSharePayload> getSharePayload({
    required String accessToken,
    required String broadcastId,
    BroadcastFeedItem? fallbackSource,
  }) async {
    final payload = await getPublicSharePayload(
      accessToken: accessToken,
      broadcastId: broadcastId,
      fallbackSource: fallbackSource,
    );
    return BroadcastSharePayload.fromPublic(payload);
  }
}
