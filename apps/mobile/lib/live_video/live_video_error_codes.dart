/// Stable Live Emergency Video error codes — aligned with API taxonomy.
import "live_video_start_validation.dart";

abstract final class LiveVideoErrorCodes {
  static const incidentUnavailable = "LIVE-VIDEO-001";
  static const notAuthorized = "LIVE-VIDEO-002";
  static const cameraPermissionDenied = "LIVE-VIDEO-003";
  static const microphonePermissionDenied = "LIVE-VIDEO-004";
  static const locationPersistDegraded = "LIVE-VIDEO-005";
  static const tokenGenerationFailed = "LIVE-VIDEO-006";
  static const sessionPersistFailed = "LIVE-VIDEO-007";
  static const livekitConfigUnavailable = "LIVE-VIDEO-008";
  static const upstreamGateway = "LIVE-VIDEO-009";
  static const clientLivekitUrlInvalid = "LIVE-VIDEO-010";
  static const unexpectedApiFailure = "LIVE-VIDEO-011";
  static const connectLivekitFailed = "LIVE-VIDEO-015";
  static const publishTracksFailed = "LIVE-VIDEO-016";
  static const authRequired = "LIVE-VIDEO-AUTH-001";
  static const startResponseInvalid = "LIVE-VIDEO-010";
}

String liveVideoStartValidationUserMessage(String reason) {
  return switch (reason) {
    LiveVideoStartValidationReason.urlMissing =>
      "Live video server URL was not returned by the API.",
    LiveVideoStartValidationReason.tokenMissing =>
      "Live video access token was not returned by the API.",
    LiveVideoStartValidationReason.roomMissing =>
      "Live video room name was not returned by the API.",
    LiveVideoStartValidationReason.tokenMalformed =>
      "Live video access token from the API was malformed.",
    LiveVideoStartValidationReason.tokenExpired =>
      "Live video access token from the API was already expired.",
    LiveVideoStartValidationReason.urlInvalidScheme =>
      "Live video server URL from the API was invalid.",
    LiveVideoStartValidationReason.schemaMismatch =>
      "Live video start response was missing connection details.",
    _ => "Live video start response could not be validated.",
  };
}

String mapLiveVideoApiError(int statusCode, String message, {String? apiCode}) {
  if (apiCode != null && apiCode.startsWith("LIVE-VIDEO-")) {
    return _withEmergencyPreserved(apiCode, _messageForApiCode(apiCode, message));
  }
  if (statusCode == 401 || statusCode == 403) {
    return _withEmergencyPreserved(
      LiveVideoErrorCodes.notAuthorized,
      "You are not authorized to access this live video room.",
    );
  }
  if (statusCode == 404) {
    return _withEmergencyPreserved(
      LiveVideoErrorCodes.incidentUnavailable,
      "Live video session is no longer available.",
    );
  }
  if (statusCode == 502 || statusCode == 503) {
    return _withEmergencyPreserved(
      LiveVideoErrorCodes.upstreamGateway,
      "Live video gateway is temporarily unavailable (LIVE-VIDEO-009). "
      "Your emergency may still have been submitted.",
    );
  }
  if (statusCode >= 500) {
    return _withEmergencyPreserved(
      LiveVideoErrorCodes.unexpectedApiFailure,
      "Live video could not start (LIVE-VIDEO-011). "
      "Your emergency may still have been submitted.",
    );
  }
  if (message.toLowerCase().contains("token")) {
    return "Live video access expired. Start a new stream.";
  }
  return message.isNotEmpty ? message : "Unable to start live video right now.";
}

String _messageForApiCode(String code, String fallback) {
  return switch (code) {
    "LIVE-VIDEO-001" => "Incident is unavailable for live video.",
    "LIVE-VIDEO-002" => "You are not authorized to start this live video stream.",
    "LIVE-VIDEO-005" =>
      "Live video started but initial GPS could not be saved. Streaming may continue.",
    "LIVE-VIDEO-006" => "LiveKit access token could not be issued.",
    "LIVE-VIDEO-007" => "Live video session could not be saved.",
    "LIVE-VIDEO-008" => "Live video is not configured on the server.",
    "LIVE-VIDEO-010" => "Live video client URL is invalid on the server.",
    "LIVE-VIDEO-011" => "Live video could not start due to an unexpected server error.",
    _ => fallback.isNotEmpty ? fallback : "Unable to start live video right now.",
  };
}

String _withEmergencyPreserved(String code, String message) {
  if (message.contains(code)) return message;
  return "$message Reference: $code.";
}

String liveVideoRetryUserMessage({required bool incidentActive}) {
  if (incidentActive) {
    return "Your emergency is active. Retry secure live video.";
  }
  return "Start live video";
}
