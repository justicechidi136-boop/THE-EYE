import "dart:convert";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "../live_video/live_video_api_models.dart";

class DangerTriggerCategory {
  const DangerTriggerCategory(this.code, this.label);

  final String code;
  final String label;
}

const dangerTriggerCategories = <DangerTriggerCategory>[
  DangerTriggerCategory("DANGER_ZONE_FIRE_NEARBY", "Fire"),
  DangerTriggerCategory("DANGER_ZONE_ARMED_ROBBERY_NEARBY", "Armed robbery"),
  DangerTriggerCategory("DANGER_ZONE_KIDNAPPING_NEARBY", "Kidnapping"),
  DangerTriggerCategory(
    "DANGER_ZONE_ACTIVE_SHOOTER_NEARBY",
    "Shooting / gunfire",
  ),
  DangerTriggerCategory("DANGER_ZONE_CIVIL_DISTURBANCE_NEARBY", "Riot"),
  DangerTriggerCategory(
    "DANGER_ZONE_BANDIT_ATTACK_NEARBY",
    "Bandit / unknown gunmen",
  ),
  DangerTriggerCategory("DANGER_ZONE_CULT_CLASH_NEARBY", "Cult clash"),
  DangerTriggerCategory(
    "DANGER_ZONE_COMMUNITY_CRISIS_NEARBY",
    "Community crisis",
  ),
  DangerTriggerCategory("DANGER_ZONE_KILLING_NEARBY", "Killing"),
];

class DangerTriggerException implements Exception {
  const DangerTriggerException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class PreparedDangerTrigger {
  const PreparedDangerTrigger({
    required this.eventId,
    required this.liveSessionId,
    required this.liveVideo,
    required this.approximateArea,
    required this.radiusMeters,
  });

  final String eventId;
  final String liveSessionId;
  final LiveVideoStartResult liveVideo;
  final String approximateArea;
  final int radiusMeters;
}

class DangerTriggerActivation {
  const DangerTriggerActivation({
    required this.recipientCount,
    required this.radiusMeters,
    required this.initiatorWatchAlertQueued,
    required this.watchRelayPayload,
  });

  final int recipientCount;
  final int radiusMeters;
  final bool initiatorWatchAlertQueued;
  final Map<String, dynamic> watchRelayPayload;
}

class DangerTriggerEventDetail {
  const DangerTriggerEventDetail({
    required this.id,
    required this.state,
    required this.approximateArea,
    required this.liveAvailable,
    required this.radiusMeters,
  });

  final String id;
  final String state;
  final String approximateArea;
  final bool liveAvailable;
  final int radiusMeters;
}

class DangerTriggerListenSession {
  const DangerTriggerListenSession({
    required this.eventId,
    required this.serverUrl,
    required this.token,
    required this.roomName,
  });

  final String eventId;
  final String serverUrl;
  final String token;
  final String roomName;
}

abstract class DangerTriggerGateway {
  Future<PreparedDangerTrigger> prepare({
    required String accessToken,
    required String clientTriggerId,
    required double latitude,
    required double longitude,
    required DateTime locationCapturedAt,
    required String locationSource,
    required String dangerAlertCode,
    double? accuracyMeters,
    String? areaName,
  });

  Future<DangerTriggerActivation> activate({
    required String accessToken,
    required String eventId,
    required String liveSessionId,
    required DateTime connectedAt,
  });

  Future<void> endLiveVoice({
    required String accessToken,
    required String eventId,
  });

  Future<void> cancel({
    required String accessToken,
    required String eventId,
    String? reason,
  });

  Future<DangerTriggerEventDetail> detail({
    required String accessToken,
    required String eventId,
  });

  Future<DangerTriggerListenSession> listen({
    required String accessToken,
    required String eventId,
  });
}

class DangerTriggerApiService implements DangerTriggerGateway {
  DangerTriggerApiService(this._apiClient);

  final TheEyeApiClient _apiClient;

  @override
  Future<PreparedDangerTrigger> prepare({
    required String accessToken,
    required String clientTriggerId,
    required double latitude,
    required double longitude,
    required DateTime locationCapturedAt,
    required String locationSource,
    required String dangerAlertCode,
    double? accuracyMeters,
    String? areaName,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.dangerTriggerPrepare,
      {
        "clientTriggerId": clientTriggerId,
        "latitude": latitude,
        "longitude": longitude,
        "accuracyMeters": accuracyMeters,
        "locationSource": locationSource,
        "dangerAlertCode": dangerAlertCode,
        "locationCapturedAt": locationCapturedAt.toUtc().toIso8601String(),
        "areaName": areaName,
        "lowBandwidthMode": true,
      },
      accessToken: accessToken,
      clientSubmissionId: clientTriggerId,
      clientTraceId: clientTriggerId,
    );
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw DangerTriggerException(
        _errorMessage(body, "Unable to prepare the live danger broadcast."),
        statusCode: response.statusCode,
      );
    }
    final data = Map<String, dynamic>.from((body["data"] as Map?) ?? const {});
    final event = Map<String, dynamic>.from(
      (data["event"] as Map?) ?? const {},
    );
    final liveSession = Map<String, dynamic>.from(
      (data["liveSession"] as Map?) ?? const {},
    );
    final eventId = event["id"]?.toString() ?? "";
    final sessionId = liveSession["id"]?.toString() ?? "";
    if (eventId.isEmpty || sessionId.isEmpty) {
      throw const DangerTriggerException(
        "The danger broadcast response was incomplete. Please try again.",
      );
    }
    final liveVideo = LiveVideoStartResult.fromResponse({
      "data": liveSession,
      "connection": body["connection"] ?? body["livekit"],
    });
    return PreparedDangerTrigger(
      eventId: eventId,
      liveSessionId: sessionId,
      liveVideo: liveVideo,
      approximateArea: event["approximateArea"]?.toString() ?? "Nearby area",
      radiusMeters: (event["effectiveRadiusMeters"] as num?)?.toInt() ?? 4000,
    );
  }

  @override
  Future<DangerTriggerActivation> activate({
    required String accessToken,
    required String eventId,
    required String liveSessionId,
    required DateTime connectedAt,
  }) async {
    final response = await _apiClient
        .postJson(TheEyeApiPaths.dangerTriggerActivate(eventId), {
          "liveVoiceSessionId": liveSessionId,
          "connectedAt": connectedAt.toUtc().toIso8601String(),
        }, accessToken: accessToken);
    _requireSuccess(
      response.statusCode,
      response.body,
      "The voice connection started, but nearby alerts could not be activated.",
    );
    final body = _decode(response.body);
    final fanout = Map<String, dynamic>.from(
      (body["fanout"] as Map?) ?? const {},
    );
    return DangerTriggerActivation(
      recipientCount: (fanout["recipients"] as num?)?.toInt() ?? 0,
      radiusMeters: (fanout["radiusMeters"] as num?)?.toInt() ?? 4000,
      initiatorWatchAlertQueued: body["initiatorWatchAlertQueued"] == true,
      watchRelayPayload: Map<String, dynamic>.from(
        (body["watchRelay"] as Map?) ?? const {},
      ),
    );
  }

  @override
  Future<void> endLiveVoice({
    required String accessToken,
    required String eventId,
  }) async {
    final response = await _apiClient.patchJson(
      TheEyeApiPaths.dangerTriggerEndVoice(eventId),
      const {},
      accessToken: accessToken,
    );
    _requireSuccess(
      response.statusCode,
      response.body,
      "Unable to end the live voice broadcast.",
    );
  }

  @override
  Future<void> cancel({
    required String accessToken,
    required String eventId,
    String? reason,
  }) async {
    final response = await _apiClient.patchJson(
      TheEyeApiPaths.dangerTriggerCancel(eventId),
      {"reason": reason ?? "Triggered by mistake"},
      accessToken: accessToken,
    );
    _requireSuccess(
      response.statusCode,
      response.body,
      "Unable to cancel this alert.",
    );
  }

  @override
  Future<DangerTriggerEventDetail> detail({
    required String accessToken,
    required String eventId,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.dangerTriggerDetail(eventId),
      accessToken: accessToken,
    );
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw DangerTriggerException(
        _errorMessage(body, "This danger alert is no longer available."),
        statusCode: response.statusCode,
      );
    }
    final data = Map<String, dynamic>.from((body["data"] as Map?) ?? const {});
    return DangerTriggerEventDetail(
      id: data["id"]?.toString() ?? eventId,
      state: data["state"]?.toString() ?? "POTENTIAL",
      approximateArea: data["approximateArea"]?.toString() ?? "Nearby area",
      liveAvailable:
          data["state"] == "ACTIVE" && data["liveVoiceEndedAt"] == null,
      radiusMeters: (data["effectiveRadiusMeters"] as num?)?.toInt() ?? 4000,
    );
  }

  @override
  Future<DangerTriggerListenSession> listen({
    required String accessToken,
    required String eventId,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.dangerTriggerListenToken(eventId),
      const {},
      accessToken: accessToken,
    );
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw DangerTriggerException(
        _errorMessage(body, "Live voice is not available for this alert."),
        statusCode: response.statusCode,
      );
    }
    final connection = Map<String, dynamic>.from(
      (body["connection"] as Map?) ?? const {},
    );
    final serverUrl = connection["serverUrl"]?.toString() ?? "";
    final token = connection["participantToken"]?.toString() ?? "";
    final roomName = connection["roomName"]?.toString() ?? "";
    if (serverUrl.isEmpty || token.isEmpty || roomName.isEmpty) {
      throw const DangerTriggerException(
        "Live voice connection details were incomplete.",
      );
    }
    return DangerTriggerListenSession(
      eventId: eventId,
      serverUrl: serverUrl,
      token: token,
      roomName: roomName,
    );
  }

  void _requireSuccess(int statusCode, String raw, String fallback) {
    if (statusCode >= 200 && statusCode < 300) return;
    throw DangerTriggerException(
      _errorMessage(_decode(raw), fallback),
      statusCode: statusCode,
    );
  }

  Map<String, dynamic> _decode(String raw) {
    try {
      final value = jsonDecode(raw);
      return value is Map ? Map<String, dynamic>.from(value) : const {};
    } catch (_) {
      return const {};
    }
  }

  String _errorMessage(Map<String, dynamic> body, String fallback) {
    final message = body["message"];
    if (message is String && message.trim().isNotEmpty) return message.trim();
    if (message is List && message.isNotEmpty) return message.first.toString();
    return fallback;
  }
}
