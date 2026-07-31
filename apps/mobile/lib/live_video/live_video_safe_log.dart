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
  String? participantIdentity,
  String? urlScheme,
  String? urlHost,
  String? serverUrlLength,
  String? tokenLength,
  String? tokenFingerprint,
  String? roomInstanceId,
  String? connectionState,
  String? exceptionType,
  String? exceptionMessage,
  String? stackTraceHead,
  String? internalReason,
  String? interruptLocation,
}) {
  final parts = <String>[
    "live_video checkpoint=$checkpoint",
    if (correlationId != null && correlationId.isNotEmpty)
      "correlationId=$correlationId",
    if (incidentId != null && incidentId.isNotEmpty) "incidentId=$incidentId",
    if (sessionId != null && sessionId.isNotEmpty) "sessionId=$sessionId",
    if (roomName != null && roomName.isNotEmpty) "roomName=$roomName",
    if (participantIdentity != null && participantIdentity.isNotEmpty)
      "participantIdentity=$participantIdentity",
    if (urlScheme != null && urlScheme.isNotEmpty) "urlScheme=$urlScheme",
    if (urlHost != null && urlHost.isNotEmpty) "urlHost=$urlHost",
    if (serverUrlLength != null && serverUrlLength.isNotEmpty)
      "serverUrlLength=$serverUrlLength",
    if (tokenLength != null && tokenLength.isNotEmpty)
      "tokenLength=$tokenLength",
    if (tokenFingerprint != null && tokenFingerprint.isNotEmpty)
      "tokenFingerprint=$tokenFingerprint",
    if (roomInstanceId != null && roomInstanceId.isNotEmpty)
      "roomInstanceId=$roomInstanceId",
    if (connectionState != null && connectionState.isNotEmpty)
      "connectionState=$connectionState",
    if (exceptionType != null && exceptionType.isNotEmpty)
      "exceptionType=$exceptionType",
    if (exceptionMessage != null && exceptionMessage.isNotEmpty)
      "exceptionMessage=$exceptionMessage",
    if (stackTraceHead != null && stackTraceHead.isNotEmpty)
      "stackTraceHead=$stackTraceHead",
    if (internalReason != null && internalReason.isNotEmpty)
      "internalReason=$internalReason",
    if (interruptLocation != null && interruptLocation.isNotEmpty)
      "interruptLocation=$interruptLocation",
  ];
  logLiveVideoEvent(parts.join(" "));
}

String liveVideoStackTraceHead(StackTrace stackTrace, {int maxLines = 4}) {
  return stackTrace
      .toString()
      .split("\n")
      .where((line) => line.trim().isNotEmpty)
      .take(maxLines)
      .join(" | ");
}
