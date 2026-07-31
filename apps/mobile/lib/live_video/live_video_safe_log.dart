import "package:flutter/foundation.dart";

void logLiveVideoEvent(String message) {
  assert(() {
    if (message
        .contains(RegExp(r"token|bearer|jwt|password", caseSensitive: false))) {
      throw FlutterError("Unsafe live video log message");
    }
    return true;
  }());
  debugPrint(message);
}

void logLiveVideoDiagnostic({
  required String checkpoint,
  String? correlationId,
  String? incidentId,
  String? sessionId,
  String? roomName,
  String? urlScheme,
  String? urlHost,
  String? tokenFingerprint,
  String? connectionState,
  String? exceptionType,
  String? exceptionMessage,
  String? internalReason,
}) {
  final parts = <String>[
    "live_video checkpoint=$checkpoint",
    if (correlationId != null && correlationId.isNotEmpty)
      "correlationId=$correlationId",
    if (incidentId != null && incidentId.isNotEmpty) "incidentId=$incidentId",
    if (sessionId != null && sessionId.isNotEmpty) "sessionId=$sessionId",
    if (roomName != null && roomName.isNotEmpty) "roomName=$roomName",
    if (urlScheme != null && urlScheme.isNotEmpty) "urlScheme=$urlScheme",
    if (urlHost != null && urlHost.isNotEmpty) "urlHost=$urlHost",
    if (tokenFingerprint != null && tokenFingerprint.isNotEmpty)
      "tokenFingerprint=$tokenFingerprint",
    if (connectionState != null && connectionState.isNotEmpty)
      "connectionState=$connectionState",
    if (exceptionType != null && exceptionType.isNotEmpty)
      "exceptionType=$exceptionType",
    if (exceptionMessage != null && exceptionMessage.isNotEmpty)
      "exceptionMessage=$exceptionMessage",
    if (internalReason != null && internalReason.isNotEmpty)
      "internalReason=$internalReason",
  ];
  logLiveVideoEvent(parts.join(" "));
}
