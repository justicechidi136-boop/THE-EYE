import "dart:io";

import "package:flutter/foundation.dart";

/// Blocks logging raw secrets while allowing structured credential metadata.
final RegExp _unsafeLiveVideoLogPattern = RegExp(
  r"(?:\bbearer\s+[a-z0-9\-._~+/]+=*|\bjwt\s*[=:]\s*\S+|"
  r"\bpassword\s*[=:]\s*\S+|(?:^|\s)(?:access_?token|participant_?token|"
  r"id_?token|refresh_?token)\s*[=:]\s*\S+)",
  caseSensitive: false,
);

void logLiveVideoEvent(String message) {
  assert(() {
    if (_unsafeLiveVideoLogPattern.hasMatch(message)) {
      throw FlutterError("Unsafe live video log message");
    }
    return true;
  }());
  debugPrint(message);
  assert(() {
    if (message.startsWith("live_video checkpoint=ICE_")) {
      final file = File(
        "${Directory.systemTemp.path}/the-eye-live-video-ice-diagnostics.log",
      );
      try {
        file.writeAsStringSync(
          "$message\n",
          mode: FileMode.append,
          flush: true,
        );
      } on FileSystemException {
        // Device diagnostics must never affect emergency video behavior.
      }
    }
    return true;
  }());
}

void logLiveVideoDiagnostic({
  required String checkpoint,
  String? correlationId,
  String? incidentId,
  String? sessionId,
  String? connectionAttemptId,
  String? roomName,
  String? participantIdentity,
  String? urlScheme,
  String? urlHost,
  String? serverUrlLength,
  String? tokenLength,
  String? tokenFingerprint,
  String? roomInstanceId,
  String? connectionState,
  String? lifecyclePhase,
  String? controllerGeneration,
  String? disconnectReason,
  String? disconnectCaller,
  String? exceptionType,
  String? exceptionMessage,
  String? stackTraceHead,
  String? internalReason,
  String? interruptLocation,
  String? timeoutName,
  String? timeoutDurationMs,
  String? cameraState,
  String? microphoneState,
  String? iceTransport,
  String? iceCandidateDirection,
  String? iceCandidateType,
  String? iceProtocol,
  String? iceAddress,
  String? icePort,
  String? icePriority,
  String? icePairState,
  String? icePairSelected,
}) {
  final parts = <String>[
    "live_video checkpoint=$checkpoint",
    if (correlationId != null && correlationId.isNotEmpty)
      "correlationId=$correlationId",
    if (incidentId != null && incidentId.isNotEmpty) "incidentId=$incidentId",
    if (sessionId != null && sessionId.isNotEmpty) "sessionId=$sessionId",
    if (connectionAttemptId != null && connectionAttemptId.isNotEmpty)
      "connectionAttemptId=$connectionAttemptId",
    if (roomName != null && roomName.isNotEmpty) "roomName=$roomName",
    if (participantIdentity != null && participantIdentity.isNotEmpty)
      "participantIdentity=$participantIdentity",
    if (urlScheme != null && urlScheme.isNotEmpty) "urlScheme=$urlScheme",
    if (urlHost != null && urlHost.isNotEmpty) "urlHost=$urlHost",
    if (serverUrlLength != null && serverUrlLength.isNotEmpty)
      "serverUrlLength=$serverUrlLength",
    if (tokenLength != null && tokenLength.isNotEmpty)
      "credentialLength=$tokenLength",
    if (tokenFingerprint != null && tokenFingerprint.isNotEmpty)
      "credentialFingerprint=$tokenFingerprint",
    if (roomInstanceId != null && roomInstanceId.isNotEmpty)
      "roomInstanceId=$roomInstanceId",
    if (connectionState != null && connectionState.isNotEmpty)
      "connectionState=$connectionState",
    if (lifecyclePhase != null && lifecyclePhase.isNotEmpty)
      "lifecyclePhase=$lifecyclePhase",
    if (controllerGeneration != null && controllerGeneration.isNotEmpty)
      "controllerGeneration=$controllerGeneration",
    if (disconnectReason != null && disconnectReason.isNotEmpty)
      "disconnectReason=$disconnectReason",
    if (disconnectCaller != null && disconnectCaller.isNotEmpty)
      "disconnectCaller=$disconnectCaller",
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
    if (timeoutName != null && timeoutName.isNotEmpty)
      "timeoutName=$timeoutName",
    if (timeoutDurationMs != null && timeoutDurationMs.isNotEmpty)
      "timeoutDurationMs=$timeoutDurationMs",
    if (cameraState != null && cameraState.isNotEmpty)
      "cameraState=$cameraState",
    if (microphoneState != null && microphoneState.isNotEmpty)
      "microphoneState=$microphoneState",
    if (iceTransport != null && iceTransport.isNotEmpty)
      "iceTransport=$iceTransport",
    if (iceCandidateDirection != null && iceCandidateDirection.isNotEmpty)
      "iceCandidateDirection=$iceCandidateDirection",
    if (iceCandidateType != null && iceCandidateType.isNotEmpty)
      "iceCandidateType=$iceCandidateType",
    if (iceProtocol != null && iceProtocol.isNotEmpty)
      "iceProtocol=$iceProtocol",
    if (iceAddress != null && iceAddress.isNotEmpty) "iceAddress=$iceAddress",
    if (icePort != null && icePort.isNotEmpty) "icePort=$icePort",
    if (icePriority != null && icePriority.isNotEmpty)
      "icePriority=$icePriority",
    if (icePairState != null && icePairState.isNotEmpty)
      "icePairState=$icePairState",
    if (icePairSelected != null && icePairSelected.isNotEmpty)
      "icePairSelected=$icePairSelected",
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
