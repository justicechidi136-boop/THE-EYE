import "live_video_error_codes.dart";
import "live_video_start_validation.dart";

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
    this.correlationId = "",
    this.participantIdentity = "",
    this.tokenExpiresAt,
  });

  final String sessionId;
  final String incidentId;
  final String roomName;
  final LiveKitCredentials livekit;
  final Map<String, dynamic>? evidenceOverlay;
  final bool recordingConfigured;
  final String correlationId;
  final String participantIdentity;
  final DateTime? tokenExpiresAt;

  factory LiveVideoStartResult.fromResponse(Map<String, dynamic> decoded) {
    final data =
        Map<String, dynamic>.from((decoded["data"] as Map?) ?? const {});
    final connectionRaw = decoded["connection"] ??
        data["connection"] ??
        decoded["livekit"] ??
        data["livekit"];
    if (connectionRaw is! Map) {
      throw LiveVideoStartValidationException(
        LiveVideoStartValidationReason.schemaMismatch,
        message: "Start response missing connection/livekit object",
      );
    }
    final connection = Map<String, dynamic>.from(connectionRaw);
    final serverUrl = _firstNonEmpty([
      connection["serverUrl"],
      connection["url"],
      connection["livekitUrl"],
    ]);
    final token = _firstNonEmpty([
      connection["participantToken"],
      connection["token"],
      connection["accessToken"],
    ]);
    final roomName = _firstNonEmpty([
      connection["roomName"],
      data["roomName"],
    ]);
    final expiresAtRaw = _firstNonEmpty([
      connection["expiresAt"],
      connection["tokenExpiresAt"],
    ]);
    DateTime? expiresAt;
    if (expiresAtRaw.isNotEmpty) {
      expiresAt = DateTime.tryParse(expiresAtRaw)?.toUtc();
    }

    LiveVideoStartValidation.validateCredentials(
      serverUrl: serverUrl,
      token: token,
      roomName: roomName,
      expiresAt: expiresAt,
    );

    final livekit = LiveKitCredentials(
      url: serverUrl,
      roomName: roomName,
      token: token,
    );
    final incident =
        Map<String, dynamic>.from((data["incident"] as Map?) ?? const {});

    return LiveVideoStartResult(
      sessionId: data["id"] as String? ?? "",
      incidentId:
          incident["id"] as String? ?? data["incidentId"] as String? ?? "",
      roomName: roomName,
      livekit: livekit,
      correlationId: data["correlationId"] as String? ??
          data["clientTraceId"] as String? ??
          "",
      participantIdentity: data["participantIdentity"] as String? ??
          connection["participantIdentity"] as String? ??
          "",
      tokenExpiresAt: expiresAt,
      evidenceOverlay: data["evidenceOverlay"] is Map
          ? Map<String, dynamic>.from(data["evidenceOverlay"] as Map)
          : null,
      recordingConfigured: data["recordingMediaId"] != null,
    );
  }
}

String _firstNonEmpty(List<Object?> values) {
  for (final value in values) {
    final text = value?.toString().trim() ?? "";
    if (text.isNotEmpty) return text;
  }
  return "";
}

