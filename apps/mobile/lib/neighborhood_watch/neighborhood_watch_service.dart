import "dart:convert";

import "../config/the_eye_api_config.dart";
import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "../contracts/the_eye_enums.dart";

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
      confidenceScore: double.tryParse("${json["confidenceScore"]}") ?? 0,
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
    this.userId,
    this.badges = const [],
    this.isVolunteer = false,
  });

  final String id;
  final String displayName;
  final String role;
  final String? userId;
  final List<String> badges;
  final bool isVolunteer;

  factory CommunityMemberItem.fromJson(Map<String, dynamic> json) {
    final badgesRaw = json["badges"];
    return CommunityMemberItem(
      id: (json["id"] as String?) ?? "",
      userId: json["userId"] as String?,
      displayName: (json["displayName"] as String?) ?? "Member",
      role: (json["role"] as String?) ?? "Resident",
      badges:
          badgesRaw is List ? badgesRaw.whereType<String>().toList() : const [],
      isVolunteer: json["isVolunteer"] == true,
    );
  }
}

class CommunityCommentItem {
  const CommunityCommentItem({
    required this.id,
    required this.body,
    required this.authorId,
    required this.authorName,
    this.createdAt,
    this.pending = false,
    this.failed = false,
    this.hasVoice = false,
    this.durationSeconds,
    this.mediaType,
  });

  final String id;
  final String body;
  final String authorId;
  final String authorName;
  final DateTime? createdAt;
  final bool pending;
  final bool failed;
  final bool hasVoice;
  final int? durationSeconds;
  final String? mediaType;

  bool get isVoiceComment =>
      hasVoice || mediaType == IncidentMediaType.audio;

  String get displayBody {
    if (isVoiceComment) {
      final duration = durationSeconds;
      if (duration != null && duration > 0) {
        return "Voice (${formatVoiceCommentDuration(duration)})";
      }
      return "Voice";
    }
    return body;
  }

  CommunityCommentItem copyWith({
    String? id,
    String? body,
    String? authorId,
    String? authorName,
    bool? pending,
    bool? failed,
    bool? hasVoice,
    int? durationSeconds,
    String? mediaType,
  }) {
    return CommunityCommentItem(
      id: id ?? this.id,
      body: body ?? this.body,
      authorId: authorId ?? this.authorId,
      authorName: authorName ?? this.authorName,
      createdAt: createdAt,
      pending: pending ?? this.pending,
      failed: failed ?? this.failed,
      hasVoice: hasVoice ?? this.hasVoice,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      mediaType: mediaType ?? this.mediaType,
    );
  }

  factory CommunityCommentItem.fromJson(Map<String, dynamic> json) {
    final author = json["author"] as Map<String, dynamic>?;
    final mediaType = json["mediaType"] as String?;
    final hasVoice = json["hasVoice"] == true ||
        mediaType == IncidentMediaType.audio;
    return CommunityCommentItem(
      id: (json["id"] as String?) ?? "",
      body: (json["body"] as String?) ?? "",
      authorId: (author?["id"] as String?) ?? "",
      authorName: (author?["displayName"] as String?) ?? "Member",
      createdAt: DateTime.tryParse((json["createdAt"] as String?) ?? ""),
      hasVoice: hasVoice,
      durationSeconds: (json["durationSeconds"] as num?)?.toInt(),
      mediaType: mediaType,
    );
  }
}

String formatVoiceCommentDuration(int seconds) {
  final minutes = seconds ~/ 60;
  final remainder = seconds % 60;
  if (minutes == 0) return "${remainder}s";
  return "${minutes}m ${remainder}s";
}

class CommunityStatistics {
  const CommunityStatistics({
    required this.memberCount,
    required this.activeVolunteers,
    required this.patrolCount,
    required this.activeAlerts,
    required this.incidentCount,
    required this.postCount,
    required this.commentCount,
    required this.memberGrowth30Days,
  });

  final int memberCount;
  final int activeVolunteers;
  final int patrolCount;
  final int activeAlerts;
  final int incidentCount;
  final int postCount;
  final int commentCount;
  final int memberGrowth30Days;

  factory CommunityStatistics.fromJson(Map<String, dynamic> json) {
    int readCount(String key) => (json[key] as num?)?.toInt() ?? 0;
    return CommunityStatistics(
      memberCount: readCount("memberCount"),
      activeVolunteers: readCount("activeVolunteers"),
      patrolCount: readCount("patrolCount"),
      activeAlerts: readCount("activeAlerts"),
      incidentCount: readCount("incidentCount"),
      postCount: readCount("postCount"),
      commentCount: readCount("commentCount"),
      memberGrowth30Days: readCount("memberGrowth30Days"),
    );
  }
}

class CommunityPostMediaItem {
  const CommunityPostMediaItem({
    required this.mediaType,
    required this.bucket,
    required this.objectKey,
    required this.contentType,
    required this.fileHash,
  });

  final String mediaType;
  final String bucket;
  final String objectKey;
  final String contentType;
  final String fileHash;

  Map<String, dynamic> toJson() => {
        "mediaType": mediaType,
        "bucket": bucket,
        "objectKey": objectKey,
        "contentType": contentType,
        "fileHash": fileHash,
      };
}

const communityReportReasons = [
  "Harassment",
  "Spam",
  "FalseInformation",
  "HateSpeech",
  "ViolenceThreat",
  "Impersonation",
  "PrivacyViolation",
  "Other",
];

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

enum NwLocationStatus {
  confirmed,
  locationRequired,
  locationStale,
  locationLowAccuracy,
  noPublicCommunity,
}

NwLocationStatus parseNwLocationStatus(String? raw) {
  switch (raw) {
    case "CONFIRMED":
      return NwLocationStatus.confirmed;
    case "LOCATION_STALE":
      return NwLocationStatus.locationStale;
    case "LOCATION_LOW_ACCURACY":
      return NwLocationStatus.locationLowAccuracy;
    case "NO_PUBLIC_COMMUNITY":
      return NwLocationStatus.noPublicCommunity;
    case "LOCATION_REQUIRED":
    default:
      return NwLocationStatus.locationRequired;
  }
}

String nwLocationStatusLabel(NwLocationStatus status) {
  switch (status) {
    case NwLocationStatus.confirmed:
      return "Location confirmed";
    case NwLocationStatus.locationRequired:
      return "Location required";
    case NwLocationStatus.locationStale:
      return "Location is stale";
    case NwLocationStatus.locationLowAccuracy:
      return "Location accuracy is too low";
    case NwLocationStatus.noPublicCommunity:
      return "No public community for this area";
  }
}

String nwLocationStatusToApi(NwLocationStatus status) {
  switch (status) {
    case NwLocationStatus.confirmed:
      return "CONFIRMED";
    case NwLocationStatus.locationRequired:
      return "LOCATION_REQUIRED";
    case NwLocationStatus.locationStale:
      return "LOCATION_STALE";
    case NwLocationStatus.locationLowAccuracy:
      return "LOCATION_LOW_ACCURACY";
    case NwLocationStatus.noPublicCommunity:
      return "NO_PUBLIC_COMMUNITY";
  }
}

String? nwLocationStatusRetryHint(NwLocationStatus status) {
  switch (status) {
    case NwLocationStatus.confirmed:
      return null;
    case NwLocationStatus.locationRequired:
      return "Enable location access and try again.";
    case NwLocationStatus.locationStale:
      return "Move to an open area and refresh your GPS fix.";
    case NwLocationStatus.locationLowAccuracy:
      return "Wait for a stronger GPS signal, then retry.";
    case NwLocationStatus.noPublicCommunity:
      return "You may be outside a mapped public safety community. Try a nearby area or join a private community.";
  }
}

const neighborhoodWatchPostTypeLabels = {
  "SuspiciousActivity": "Suspicious activity",
  "LostChild": "Lost child",
  "MissingPerson": "Missing person",
  "CrimeAlert": "Crime alert",
  "AccidentAlert": "Accident alert",
  "FireAlert": "Fire alert",
  "FloodWarning": "Flood warning",
  "CommunityAnnouncement": "Community announcement",
  "SecurityMeeting": "Security meeting",
  "PatrolUpdate": "Patrol update",
  "SafetyTip": "Safety tip",
  "Discussion": "Discussion",
  "LocalWarning": "Local warning",
  "RoadHazard": "Road hazard",
  "CommunityQuestion": "Community question",
};

class NwPublicCommunityCard {
  const NwPublicCommunityCard({
    required this.id,
    required this.name,
    required this.visibility,
    required this.country,
    this.state,
    this.lga,
    this.description,
    this.label,
  });

  final String id;
  final String name;
  final String visibility;
  final String country;
  final String? state;
  final String? lga;
  final String? description;
  final String? label;

  factory NwPublicCommunityCard.fromJson(Map<String, dynamic> json) {
    return NwPublicCommunityCard(
      id: (json["id"] as String?) ?? "",
      name: (json["name"] as String?) ?? "",
      visibility: (json["visibility"] as String?) ?? "Public",
      country: (json["country"] as String?) ?? "",
      state: json["state"] as String?,
      lga: json["lga"] as String?,
      description: json["description"] as String?,
      label: json["label"] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        "id": id,
        "name": name,
        "visibility": visibility,
        "country": country,
        if (state != null) "state": state,
        if (lga != null) "lga": lga,
        if (description != null) "description": description,
        if (label != null) "label": label,
      };

  String get areaLabel {
    final parts = [lga, state, country]
        .whereType<String>()
        .where((part) => part.isNotEmpty)
        .toList();
    return parts.isEmpty ? name : parts.join(", ");
  }

  CommunitySummary toCommunitySummary({int activeAlertsCount = 0}) {
    return CommunitySummary(
      id: id,
      name: name,
      visibility: visibility,
      memberCount: 0,
      activeAlertsCount: activeAlertsCount,
      description: description,
      country: country,
      state: state,
      lga: lga,
    );
  }
}

class NwPresenceInfo {
  const NwPresenceInfo({
    this.mode,
    this.communityId,
    this.capturedAt,
    this.expiresAt,
    this.accuracyM,
    this.switchRecommended = false,
    this.switchMessage,
  });

  final String? mode;
  final String? communityId;
  final DateTime? capturedAt;
  final DateTime? expiresAt;
  final double? accuracyM;
  final bool switchRecommended;
  final String? switchMessage;

  factory NwPresenceInfo.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const NwPresenceInfo();
    }
    return NwPresenceInfo(
      mode: json["mode"] as String?,
      communityId: json["communityId"] as String?,
      capturedAt: DateTime.tryParse((json["capturedAt"] as String?) ?? ""),
      expiresAt: DateTime.tryParse((json["expiresAt"] as String?) ?? ""),
      accuracyM: (json["accuracyM"] as num?)?.toDouble(),
      switchRecommended: json["switchRecommended"] == true,
      switchMessage: json["switchMessage"] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        if (mode != null) "mode": mode,
        if (communityId != null) "communityId": communityId,
        if (capturedAt != null) "capturedAt": capturedAt!.toIso8601String(),
        if (expiresAt != null) "expiresAt": expiresAt!.toIso8601String(),
        if (accuracyM != null) "accuracyM": accuracyM,
        "switchRecommended": switchRecommended,
        if (switchMessage != null) "switchMessage": switchMessage,
      };
}

class NwSafetySummary {
  const NwSafetySummary({
    required this.activeAlerts,
    required this.recentVerifiedIncidents,
    required this.roadHazards,
    required this.publicBroadcasts,
    required this.communityWarnings,
  });

  final int activeAlerts;
  final int recentVerifiedIncidents;
  final int roadHazards;
  final int publicBroadcasts;
  final int communityWarnings;

  factory NwSafetySummary.fromJson(Map<String, dynamic>? json) {
    int read(String key) => (json?[key] as num?)?.toInt() ?? 0;
    return NwSafetySummary(
      activeAlerts: read("activeAlerts"),
      recentVerifiedIncidents: read("recentVerifiedIncidents"),
      roadHazards: read("roadHazards"),
      publicBroadcasts: read("publicBroadcasts"),
      communityWarnings: read("communityWarnings"),
    );
  }

  Map<String, dynamic> toJson() => {
        "activeAlerts": activeAlerts,
        "recentVerifiedIncidents": recentVerifiedIncidents,
        "roadHazards": roadHazards,
        "publicBroadcasts": publicBroadcasts,
        "communityWarnings": communityWarnings,
      };
}

class NwPermissions {
  const NwPermissions({
    required this.canViewPublicFeed,
    required this.canPost,
    required this.canComment,
    required this.canViewPrivateFeed,
    required this.canModerate,
    required this.canManagePatrol,
  });

  final bool canViewPublicFeed;
  final bool canPost;
  final bool canComment;
  final bool canViewPrivateFeed;
  final bool canModerate;
  final bool canManagePatrol;

  factory NwPermissions.fromJson(Map<String, dynamic>? json) {
    bool read(String key) => json?[key] == true;
    return NwPermissions(
      canViewPublicFeed: read("canViewPublicFeed"),
      canPost: read("canPost"),
      canComment: read("canComment"),
      canViewPrivateFeed: read("canViewPrivateFeed"),
      canModerate: read("canModerate"),
      canManagePatrol: read("canManagePatrol"),
    );
  }

  static const empty = NwPermissions(
    canViewPublicFeed: false,
    canPost: false,
    canComment: false,
    canViewPrivateFeed: false,
    canModerate: false,
    canManagePatrol: false,
  );

  Map<String, dynamic> toJson() => {
        "canViewPublicFeed": canViewPublicFeed,
        "canPost": canPost,
        "canComment": canComment,
        "canViewPrivateFeed": canViewPrivateFeed,
        "canModerate": canModerate,
        "canManagePatrol": canManagePatrol,
      };
}

class NwPrivateCommunityNearby {
  const NwPrivateCommunityNearby({
    required this.id,
    required this.name,
    required this.approximateDistanceMeters,
    this.membershipStatus,
    this.accessHint,
  });

  final String id;
  final String name;
  final int approximateDistanceMeters;
  final String? membershipStatus;
  final String? accessHint;

  factory NwPrivateCommunityNearby.fromJson(Map<String, dynamic> json) {
    return NwPrivateCommunityNearby(
      id: (json["id"] as String?) ?? "",
      name: (json["name"] as String?) ?? "",
      approximateDistanceMeters:
          (json["approximateDistanceMeters"] as num?)?.toInt() ?? 0,
      membershipStatus: json["membershipStatus"] as String?,
      accessHint: json["accessHint"] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        "id": id,
        "name": name,
        "approximateDistanceMeters": approximateDistanceMeters,
        if (membershipStatus != null) "membershipStatus": membershipStatus,
        if (accessHint != null) "accessHint": accessHint,
      };
}

class NwContextResponse {
  const NwContextResponse({
    required this.locationStatus,
    this.publicCommunity,
    this.presence,
    this.homeCommunity,
    this.privateCommunitiesNearby = const [],
    this.permissions = NwPermissions.empty,
    this.safetySummary = const NwSafetySummary(
      activeAlerts: 0,
      recentVerifiedIncidents: 0,
      roadHazards: 0,
      publicBroadcasts: 0,
      communityWarnings: 0,
    ),
  });

  final NwLocationStatus locationStatus;
  final NwPublicCommunityCard? publicCommunity;
  final NwPresenceInfo? presence;
  final NwPublicCommunityCard? homeCommunity;
  final List<NwPrivateCommunityNearby> privateCommunitiesNearby;
  final NwPermissions permissions;
  final NwSafetySummary safetySummary;

  bool get isConfirmed => locationStatus == NwLocationStatus.confirmed;

  factory NwContextResponse.fromJson(Map<String, dynamic> json) {
    final privateRaw = json["privateCommunitiesNearby"];
    return NwContextResponse(
      locationStatus: parseNwLocationStatus(json["locationStatus"] as String?),
      publicCommunity: json["publicCommunity"] is Map
          ? NwPublicCommunityCard.fromJson(
              Map<String, dynamic>.from(json["publicCommunity"] as Map))
          : null,
      presence: json["presence"] is Map
          ? NwPresenceInfo.fromJson(
              Map<String, dynamic>.from(json["presence"] as Map))
          : null,
      homeCommunity: json["homeCommunity"] is Map
          ? NwPublicCommunityCard.fromJson(
              Map<String, dynamic>.from(json["homeCommunity"] as Map))
          : null,
      privateCommunitiesNearby: privateRaw is List
          ? privateRaw
              .whereType<Map>()
              .map((item) => NwPrivateCommunityNearby.fromJson(
                  Map<String, dynamic>.from(item)))
              .toList()
          : const [],
      permissions: NwPermissions.fromJson(
        json["permissions"] is Map
            ? Map<String, dynamic>.from(json["permissions"] as Map)
            : null,
      ),
      safetySummary: NwSafetySummary.fromJson(
        json["safetySummary"] is Map
            ? Map<String, dynamic>.from(json["safetySummary"] as Map)
            : null,
      ),
    );
  }

  Map<String, dynamic> toJson() => {
        "locationStatus": nwLocationStatusToApi(locationStatus),
        if (publicCommunity != null)
          "publicCommunity": publicCommunity!.toJson(),
        if (presence != null) "presence": presence!.toJson(),
        if (homeCommunity != null) "homeCommunity": homeCommunity!.toJson(),
        "privateCommunitiesNearby":
            privateCommunitiesNearby.map((item) => item.toJson()).toList(),
        "permissions": permissions.toJson(),
        "safetySummary": safetySummary.toJson(),
      };
}

class NeighborhoodWatchService {
  NeighborhoodWatchService({TheEyeApiClient? apiClient})
      : _apiClient = apiClient ??
            TheEyeApiClient(baseUrl: TheEyeApiConfig.resolveBaseUrl());

  final TheEyeApiClient _apiClient;

  Future<NwContextResponse> resolveContext({
    required String accessToken,
    double? lat,
    double? lng,
    double? accuracy,
    DateTime? capturedAt,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.neighborhoodWatchContext,
      accessToken: accessToken,
      query: {
        if (lat != null) "lat": "$lat",
        if (lng != null) "lng": "$lng",
        if (accuracy != null) "accuracy": "$accuracy",
        if (capturedAt != null)
          "capturedAt": capturedAt.toUtc().toIso8601String(),
      },
    );
    _ensureSuccess(response);
    final decoded = jsonDecode(response.body);
    final data = decoded is Map ? decoded["data"] ?? decoded : decoded;
    return NwContextResponse.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<void> setHomeCommunity({
    required String accessToken,
    String? communityId,
  }) async {
    final response = await _apiClient.patchJson(
      TheEyeApiPaths.neighborhoodWatchHomeCommunity,
      {"communityId": communityId},
      accessToken: accessToken,
    );
    _ensureSuccess(response);
  }

  Future<void> restorePost({
    required String accessToken,
    required String postId,
  }) async {
    final response = await _apiClient.patchJson(
      TheEyeApiPaths.neighborhoodWatchPostRestore(postId),
      const {},
      accessToken: accessToken,
    );
    _ensureSuccess(response);
  }

  Future<void> joinPatrol({
    required String accessToken,
    required String scheduleId,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.neighborhoodWatchPatrolJoin(scheduleId),
      const {},
      accessToken: accessToken,
    );
    _ensureSuccess(response);
  }

  Future<void> createPatrolObservation({
    required String accessToken,
    required String scheduleId,
    required String body,
    double? latitude,
    double? longitude,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.neighborhoodWatchPatrolObservations(scheduleId),
      {
        "body": body,
        if (latitude != null) "latitude": latitude,
        if (longitude != null) "longitude": longitude,
      },
      accessToken: accessToken,
    );
    _ensureSuccess(response);
  }

  Future<List<CommunityPostItem>> listOfficialAlerts({
    required String accessToken,
    required String communityId,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.neighborhoodWatchCommunityOfficialAlerts(communityId),
      accessToken: accessToken,
    );
    _ensureSuccess(response);
    final decoded = jsonDecode(response.body);
    final rows = decoded is Map && decoded["data"] is List
        ? decoded["data"] as List
        : decoded is List
            ? decoded
            : const [];
    return rows
        .whereType<Map>()
        .map((item) =>
            CommunityPostItem.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

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
    List<CommunityPostMediaItem> media = const [],
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.neighborhoodWatchCommunityPosts(communityId),
      {
        "type": type,
        "title": title,
        "body": body,
        if (latitude != null) "latitude": latitude,
        if (longitude != null) "longitude": longitude,
        if (media.isNotEmpty)
          "media": media.map((item) => item.toJson()).toList(),
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
    String? search,
    String? cursor,
    int limit = 25,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.neighborhoodWatchCommunityMembers(communityId),
      accessToken: accessToken,
      query: {
        "limit": "$limit",
        if (search != null && search.isNotEmpty) "search": search,
        if (cursor != null) "cursor": cursor,
      },
    );
    return _decodePage(response, CommunityMemberItem.fromJson);
  }

  Future<CommunityStatistics> getStatistics({
    required String accessToken,
    required String communityId,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.neighborhoodWatchCommunityStatistics(communityId),
      accessToken: accessToken,
    );
    _ensureSuccess(response);
    final decoded = jsonDecode(response.body);
    final data = decoded is Map ? decoded["data"] ?? decoded : decoded;
    return CommunityStatistics.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<CommunityPage<CommunityCommentItem>> listComments({
    required String accessToken,
    required String postId,
    String? cursor,
    int limit = 25,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.neighborhoodWatchPostComments(postId),
      accessToken: accessToken,
      query: {
        "limit": "$limit",
        if (cursor != null) "cursor": cursor,
      },
    );
    return _decodePage(response, CommunityCommentItem.fromJson);
  }

  Future<CommunityCommentItem> createComment({
    required String accessToken,
    required String postId,
    String? body,
    String? mediaType,
    String? bucket,
    String? objectKey,
    String? contentType,
    int? durationSeconds,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.neighborhoodWatchPostComments(postId),
      {
        if (body != null && body.isNotEmpty) "body": body,
        if (mediaType != null) "mediaType": mediaType,
        if (bucket != null) "bucket": bucket,
        if (objectKey != null) "objectKey": objectKey,
        if (contentType != null) "contentType": contentType,
        if (durationSeconds != null) "durationSeconds": durationSeconds,
      },
      accessToken: accessToken,
    );
    _ensureSuccess(response);
    final decoded = jsonDecode(response.body);
    final data = decoded is Map ? decoded["data"] ?? decoded : decoded;
    final map = Map<String, dynamic>.from(data as Map);
    final hasVoice = map["hasVoice"] == true ||
        mediaType == IncidentMediaType.audio ||
        (bucket != null && objectKey != null);
    return CommunityCommentItem(
      id: (map["id"] as String?) ?? "",
      body: (map["body"] as String?) ?? body ?? "",
      authorId: (map["authorId"] as String?) ?? "",
      authorName: "You",
      createdAt: DateTime.tryParse((map["createdAt"] as String?) ?? "") ??
          DateTime.now(),
      hasVoice: hasVoice,
      durationSeconds: (map["durationSeconds"] as num?)?.toInt() ??
          durationSeconds,
      mediaType: hasVoice ? (mediaType ?? IncidentMediaType.audio) : mediaType,
    );
  }

  Future<CommunityCommentItem> updateComment({
    required String accessToken,
    required String postId,
    required String commentId,
    required String body,
  }) async {
    final response = await _apiClient.patchJson(
      TheEyeApiPaths.neighborhoodWatchPostComment(postId, commentId),
      {"body": body},
      accessToken: accessToken,
    );
    _ensureSuccess(response);
    final decoded = jsonDecode(response.body);
    final data = decoded is Map ? decoded["data"] ?? decoded : decoded;
    final map = Map<String, dynamic>.from(data as Map);
    return CommunityCommentItem(
      id: commentId,
      body: (map["body"] as String?) ?? body,
      authorId: "",
      authorName: "You",
      createdAt: DateTime.tryParse((map["updatedAt"] as String?) ?? ""),
    );
  }

  Future<void> deleteComment({
    required String accessToken,
    required String postId,
    required String commentId,
  }) async {
    final response = await _apiClient.deleteJson(
      TheEyeApiPaths.neighborhoodWatchPostComment(postId, commentId),
      accessToken: accessToken,
    );
    _ensureSuccess(response);
  }

  Future<void> submitReport({
    required String accessToken,
    required String communityId,
    required String targetType,
    required String targetId,
    required String reasonCode,
    String? note,
    String? evidenceObjectKey,
    String? evidenceBucket,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.neighborhoodWatchCommunityReports(communityId),
      {
        "targetType": targetType,
        "targetId": targetId,
        "reasonCode": reasonCode,
        if (note != null && note.isNotEmpty) "note": note,
        if (evidenceObjectKey != null) "evidenceObjectKey": evidenceObjectKey,
        if (evidenceBucket != null) "evidenceBucket": evidenceBucket,
      },
      accessToken: accessToken,
    );
    _ensureSuccess(response);
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
