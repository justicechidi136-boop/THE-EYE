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
    final livekit = LiveKitCredentials.fromJson(
        Map<String, dynamic>.from((decoded["livekit"] as Map?) ?? const {}));
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

String mapLiveVideoApiError(int statusCode, String message) {
  if (statusCode == 401 || statusCode == 403) {
    return "You are not authorized to access this live video room.";
  }
  if (statusCode == 404) return "Live video session is no longer available.";
  if (statusCode == 429)
    return "Too many live stream requests. Wait a minute and try again.";
  if (message.toLowerCase().contains("token"))
    return "Live video access expired. Start a new stream.";
  return message.isNotEmpty ? message : "Unable to start live video right now.";
}
