import "dart:convert";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";

class CommunitySummary {
  const CommunitySummary({
    required this.id,
    required this.name,
    required this.visibility,
    required this.memberCount,
    required this.activeAlertsCount,
    this.description,
    this.country,
    this.state,
    this.lga,
    this.membershipStatus,
    this.latestActivityAt,
    this.channels,
  });

  final String id;
  final String name;
  final String visibility;
  final int memberCount;
  final int activeAlertsCount;
  final String? description;
  final String? country;
  final String? state;
  final String? lga;
  final String? membershipStatus;
  final DateTime? latestActivityAt;
  final List<CommunityChannelSummary>? channels;

  factory CommunitySummary.fromJson(Map<String, dynamic> json) {
    final channelsRaw = json["channels"];
    return CommunitySummary(
      id: (json["id"] as String?) ?? "",
      name: (json["name"] as String?) ?? "",
      visibility: (json["visibility"] as String?) ?? "Public",
      memberCount: (json["memberCount"] as num?)?.toInt() ?? 0,
      activeAlertsCount: (json["activeAlertsCount"] as num?)?.toInt() ?? 0,
      description: json["description"] as String?,
      country: json["country"] as String?,
      state: json["state"] as String?,
      lga: json["lga"] as String?,
      membershipStatus: json["membershipStatus"] as String?,
      latestActivityAt:
          DateTime.tryParse((json["latestActivityAt"] as String?) ?? ""),
      channels: channelsRaw is List
          ? channelsRaw
              .whereType<Map>()
              .map((item) => CommunityChannelSummary.fromJson(
                  Map<String, dynamic>.from(item)))
              .toList()
          : null,
    );
  }

  bool get isMember => membershipStatus == "Approved";
  bool get isPending => membershipStatus == "Pending";
}

class CommunityChannelSummary {
  const CommunityChannelSummary({
    required this.id,
    required this.type,
    required this.name,
  });

  final String id;
  final String type;
  final String name;

  factory CommunityChannelSummary.fromJson(Map<String, dynamic> json) {
    return CommunityChannelSummary(
      id: (json["id"] as String?) ?? "",
      type: (json["type"] as String?) ?? "",
      name: (json["name"] as String?) ?? "",
    );
  }
}

class CommunityPostItem {
  const CommunityPostItem({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.verificationStatus,
    required this.confidenceScore,
    required this.createdAt,
    this.authorName,
  });

  final String id;
  final String title;
  final String body;
  final String type;
  final String verificationStatus;
  final double confidenceScore;
  final DateTime? createdAt;
  final String? authorName;

  factory CommunityPostItem.fromJson(Map<String, dynamic> json) {
    final author = json["author"] as Map<String, dynamic>?;
    final profile = author?["profile"] as Map<String, dynamic>?;
    final authorName = profile == null
        ? null
        : [profile["firstName"], profile["lastName"]]
            .whereType<String>()
            .where((part) => part.isNotEmpty)
            .join(" ");
    return CommunityPostItem(
      id: (json["id"] as String?) ?? "",
      title: (json["title"] as String?) ?? "",
      body: (json["body"] as String?) ?? "",
      type: (json["type"] as String?) ?? "CommunityAnnouncement",
      verificationStatus:
          (json["verificationStatus"] as String?) ?? "PendingVerification",
      confidenceScore:
          double.tryParse("${json["confidenceScore"]}") ?? 0,
      createdAt: DateTime.tryParse((json["createdAt"] as String?) ?? ""),
      authorName: authorName,
    );
  }
}

class CommunityMemberItem {
  const CommunityMemberItem({
    required this.id,
    required this.displayName,
    required this.role,
  });

  final String id;
  final String displayName;
  final String role;

  factory CommunityMemberItem.fromJson(Map<String, dynamic> json) {
    return CommunityMemberItem(
      id: (json["id"] as String?) ?? "",
      displayName: (json["displayName"] as String?) ?? "Member",
      role: (json["role"] as String?) ?? "Resident",
    );
  }
}

class PatrolScheduleItem {
  const PatrolScheduleItem({
    required this.id,
    required this.title,
    required this.status,
    required this.startsAt,
    required this.endsAt,
  });

  final String id;
  final String title;
  final String status;
  final DateTime? startsAt;
  final DateTime? endsAt;

  factory PatrolScheduleItem.fromJson(Map<String, dynamic> json) {
    return PatrolScheduleItem(
      id: (json["id"] as String?) ?? "",
      title: (json["title"] as String?) ?? "Patrol",
      status: (json["status"] as String?) ?? "Scheduled",
      startsAt: DateTime.tryParse((json["startsAt"] as String?) ?? ""),
      endsAt: DateTime.tryParse((json["endsAt"] as String?) ?? ""),
    );
  }
}

class CommunityPage<T> {
  const CommunityPage({
    required this.items,
    this.nextCursor,
  });

  final List<T> items;
  final String? nextCursor;
}

class NeighborhoodWatchService {
  NeighborhoodWatchService({TheEyeApiClient? apiClient})
      : _apiClient = apiClient ??
            TheEyeApiClient(baseUrl: TheEyeApiPaths.defaultBaseUrl);

  final TheEyeApiClient _apiClient;

  Future<CommunityPage<CommunitySummary>> listCommunities({
    required String accessToken,
    String? search,
    String? cursor,
    int limit = 25,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.neighborhoodWatchCommunities,
      accessToken: accessToken,
      query: {
        "limit": "$limit",
        if (search != null && search.isNotEmpty) "search": search,
        if (cursor != null) "cursor": cursor,
      },
    );
    return _decodePage(response, CommunitySummary.fromJson);
  }

  Future<CommunitySummary> getCommunity({
    required String accessToken,
    required String communityId,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.neighborhoodWatchCommunity(communityId),
      accessToken: accessToken,
    );
    _ensureSuccess(response);
    final decoded = jsonDecode(response.body);
    final data = decoded is Map ? decoded["data"] ?? decoded : decoded;
    return CommunitySummary.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<void> joinCommunity({
    required String accessToken,
    required String communityId,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.neighborhoodWatchCommunityJoin(communityId),
      const {},
      accessToken: accessToken,
    );
    _ensureSuccess(response);
  }

  Future<void> leaveCommunity({
    required String accessToken,
    required String communityId,
  }) async {
    final response = await _apiClient.patchJson(
      TheEyeApiPaths.neighborhoodWatchCommunityLeave(communityId),
      const {},
      accessToken: accessToken,
    );
    _ensureSuccess(response);
  }

  Future<CommunityPage<CommunityPostItem>> communityFeed({
    required String accessToken,
    required String communityId,
    String? cursor,
    int limit = 25,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.neighborhoodWatchCommunityFeed(communityId),
      accessToken: accessToken,
      query: {
        "limit": "$limit",
        if (cursor != null) "cursor": cursor,
      },
    );
    return _decodePage(response, CommunityPostItem.fromJson);
  }

  Future<CommunityPage<CommunityPostItem>> communityAlerts({
    required String accessToken,
    required String communityId,
    String? cursor,
    int limit = 25,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.neighborhoodWatchCommunityAlerts(communityId),
      accessToken: accessToken,
      query: {
        "limit": "$limit",
        if (cursor != null) "cursor": cursor,
      },
    );
    return _decodePage(response, CommunityPostItem.fromJson);
  }

  Future<CommunityPostItem> createPost({
    required String accessToken,
    required String communityId,
    required String type,
    required String title,
    required String body,
    double? latitude,
    double? longitude,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.neighborhoodWatchCommunityPosts(communityId),
      {
        "type": type,
        "title": title,
        "body": body,
        if (latitude != null) "latitude": latitude,
        if (longitude != null) "longitude": longitude,
      },
      accessToken: accessToken,
    );
    _ensureSuccess(response);
    final decoded = jsonDecode(response.body);
    final data = decoded is Map ? decoded["data"] ?? decoded : decoded;
    return CommunityPostItem.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<CommunityPage<CommunityMemberItem>> listMembers({
    required String accessToken,
    required String communityId,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.neighborhoodWatchCommunityMembers(communityId),
      accessToken: accessToken,
    );
    return _decodePage(response, CommunityMemberItem.fromJson);
  }

  Future<void> registerVolunteer({
    required String accessToken,
    required String communityId,
    required List<String> types,
    double? latitude,
    double? longitude,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.neighborhoodWatchVolunteers,
      {
        "communityId": communityId,
        "types": types,
        if (latitude != null) "latitude": latitude,
        if (longitude != null) "longitude": longitude,
      },
      accessToken: accessToken,
    );
    _ensureSuccess(response);
  }

  Future<List<PatrolScheduleItem>> listPatrols({
    required String accessToken,
    required String communityId,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.neighborhoodWatchCommunityPatrols(communityId),
      accessToken: accessToken,
    );
    _ensureSuccess(response);
    final decoded = jsonDecode(response.body);
    final rows = decoded is Map && decoded["data"] is List
        ? decoded["data"] as List
        : const [];
    return rows
        .whereType<Map>()
        .map((item) =>
            PatrolScheduleItem.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<void> logCheckpoint({
    required String accessToken,
    required String scheduleId,
    required String label,
    required double latitude,
    required double longitude,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.neighborhoodWatchPatrolCheckpoint(scheduleId),
      {
        "label": label,
        "latitude": latitude,
        "longitude": longitude,
      },
      accessToken: accessToken,
    );
    _ensureSuccess(response);
  }

  Future<List<Map<String, dynamic>>> listChannelMessages({
    required String accessToken,
    required String channelId,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.neighborhoodWatchChannelMessages(channelId),
      accessToken: accessToken,
    );
    _ensureSuccess(response);
    final decoded = jsonDecode(response.body);
    final rows = decoded is Map && decoded["data"] is List
        ? decoded["data"] as List
        : const [];
    return rows
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Future<void> sendChannelMessage({
    required String accessToken,
    required String channelId,
    required String body,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.neighborhoodWatchChannelMessages(channelId),
      {"body": body},
      accessToken: accessToken,
    );
    _ensureSuccess(response);
  }

  CommunityPage<T> _decodePage<T>(
    dynamic response,
    T Function(Map<String, dynamic> json) mapper,
  ) {
    _ensureSuccess(response);
    final decoded = jsonDecode(response.body);
    final rows = decoded is Map && decoded["data"] is List
        ? decoded["data"] as List
        : decoded is List
            ? decoded
            : const [];
    return CommunityPage<T>(
      items: rows
          .whereType<Map>()
          .map((item) => mapper(Map<String, dynamic>.from(item)))
          .toList(),
      nextCursor: decoded is Map ? decoded["nextCursor"] as String? : null,
    );
  }

  void _ensureSuccess(dynamic response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
  }
}
