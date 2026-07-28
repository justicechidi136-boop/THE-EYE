import "live_video_error_codes.dart";

export "live_video_error_codes.dart" show mapLiveVideoApiError, liveVideoRetryUserMessage;

class LiveKitCredentials {
  const LiveKitCredentials(
      {required this.url, required this.roomName, required this.token});

  final String url;
  final String roomName;
  final String token;

  factory LiveKitCredentials.fromJson(Map<String, dynamic>? raw) {
    final value = raw ?? const <String, dynamic>{};
    return LiveKitCredentials(
      url: value["url"] as String? ?? "",
      roomName: value["roomName"] as String? ?? "",
      token: value["token"] as String? ?? "",
    );
  }

  bool get isValid => url.isNotEmpty && roomName.isNotEmpty && token.isNotEmpty;
}

class LiveVideoStartResult {
  const LiveVideoStartResult({
    required this.sessionId,
    required this.incidentId,
    required this.roomName,
    required this.livekit,
    required this.evidenceOverlay,
    required this.recordingConfigured,
  });

  final String sessionId;
  final String incidentId;
  final String roomName;
  final LiveKitCredentials livekit;
  final Map<String, dynamic>? evidenceOverlay;
  final bool recordingConfigured;

  factory LiveVideoStartResult.fromResponse(Map<String, dynamic> decoded) {
    final data =
        Map<String, dynamic>.from((decoded["data"] as Map?) ?? const {});
    final incident =
        Map<String, dynamic>.from((data["incident"] as Map?) ?? const {});
    final livekitRaw = decoded["livekit"] ?? data["livekit"];
    final livekit = LiveKitCredentials.fromJson(
        livekitRaw is Map ? Map<String, dynamic>.from(livekitRaw) : null);
    return LiveVideoStartResult(
      sessionId: data["id"] as String? ?? "",
      incidentId:
          incident["id"] as String? ?? data["incidentId"] as String? ?? "",
      roomName: data["roomName"] as String? ?? livekit.roomName,
      livekit: livekit,
      evidenceOverlay: data["evidenceOverlay"] is Map
          ? Map<String, dynamic>.from(data["evidenceOverlay"] as Map)
          : null,
      recordingConfigured: data["recordingMediaId"] != null,
    );
  }
}

