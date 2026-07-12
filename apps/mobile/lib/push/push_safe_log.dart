import "package:flutter/foundation.dart";

void logPushEvent(String message) {
  if (kDebugMode) {
    // Never log raw FCM registration tokens.
    debugPrint("[THE EYE push] $message");
  }
}

String maskPushToken(String token) {
  final trimmed = token.trim();
  if (trimmed.length <= 8) return "[short-token]";
  return "...${trimmed.substring(trimmed.length - 8)}";
}
