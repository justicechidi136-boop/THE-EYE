abstract final class LiveVideoStartValidationReason {
  static const urlMissing = "START_RESPONSE_URL_MISSING";
  static const tokenMissing = "START_RESPONSE_TOKEN_MISSING";
  static const roomMissing = "START_RESPONSE_ROOM_MISSING";
  static const tokenExpired = "START_RESPONSE_TOKEN_EXPIRED";
  static const tokenMalformed = "START_RESPONSE_TOKEN_MALFORMED";
  static const urlInvalidScheme = "START_RESPONSE_URL_INVALID_SCHEME";
  static const schemaMismatch = "START_RESPONSE_SCHEMA_MISMATCH";
}

class LiveVideoStartValidationException implements Exception {
  LiveVideoStartValidationException(this.reason, {this.message});

  final String reason;
  final String? message;

  @override
  String toString() => "LiveVideoStartValidationException($reason${message == null ? "" : ": $message"})";
}

class LiveVideoStartValidation {
  static void validateCredentials({
    required String serverUrl,
    required String token,
    required String roomName,
    DateTime? expiresAt,
    DateTime? now,
  }) {
    final clock = now ?? DateTime.now().toUtc();
    if (serverUrl.trim().isEmpty) {
      throw LiveVideoStartValidationException(
        LiveVideoStartValidationReason.urlMissing,
        message: "LiveKit server URL missing from start response",
      );
    }
    final uri = Uri.tryParse(serverUrl.trim());
    if (uri == null || (uri.scheme != "ws" && uri.scheme != "wss")) {
      throw LiveVideoStartValidationException(
        LiveVideoStartValidationReason.urlInvalidScheme,
        message: "LiveKit server URL must use ws:// or wss://",
      );
    }
    if (token.trim().isEmpty) {
      throw LiveVideoStartValidationException(
        LiveVideoStartValidationReason.tokenMissing,
        message: "LiveKit participant token missing from start response",
      );
    }
    if (roomName.trim().isEmpty) {
      throw LiveVideoStartValidationException(
        LiveVideoStartValidationReason.roomMissing,
        message: "LiveKit room name missing from start response",
      );
    }
    final parts = token.split(".");
    if (parts.length != 3 || parts.any((part) => part.isEmpty)) {
      throw LiveVideoStartValidationException(
        LiveVideoStartValidationReason.tokenMalformed,
        message: "LiveKit participant token is not a JWT",
      );
    }
    if (expiresAt != null && !expiresAt.isAfter(clock)) {
      throw LiveVideoStartValidationException(
        LiveVideoStartValidationReason.tokenExpired,
        message: "LiveKit participant token already expired",
      );
    }
  }
}

String liveVideoTokenFingerprint(String token) {
  final normalized = token.trim();
  if (normalized.isEmpty) return "";
  var hash = 0;
  for (final unit in normalized.codeUnits) {
    hash = (hash * 31 + unit) & 0x7fffffff;
  }
  return hash.toRadixString(16).padLeft(8, "0");
}

Uri? liveVideoUrlHost(String serverUrl) {
  final uri = Uri.tryParse(serverUrl.trim());
  if (uri == null || uri.host.isEmpty) return null;
  return uri;
}
