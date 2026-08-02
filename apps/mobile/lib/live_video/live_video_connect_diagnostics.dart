import "dart:async";

import "package:connectivity_plus/connectivity_plus.dart";
import "package:livekit_client/livekit_client.dart";

import "live_video_join_flow.dart";
import "live_video_safe_log.dart";

String formatLiveVideoConnectivity(List<ConnectivityResult> results) {
  if (results.isEmpty) return "unknown";
  return results.map((result) => result.name).join("|");
}

String? formatLiveKitConnectException(Object error) {
  if (error is ConnectException) {
    return "ConnectException(reason=${error.reason.name}, "
        "statusCode=${error.statusCode}, message=${error.message})";
  }
  if (error is MediaConnectException) {
    return "MediaConnectException(message=${error.message})";
  }
  if (error is LiveKitException) {
    return "${error.runtimeType}(message=${error.message})";
  }
  return null;
}

Future<void> logLiveVideoConnectivity({
  required String correlationId,
  String? sessionId,
  String? internalReason,
}) async {
  final results = await Connectivity().checkConnectivity();
  logLiveVideoDiagnostic(
    checkpoint: LiveVideoJoinCheckpoint.connectivityChecked,
    correlationId: correlationId,
    sessionId: sessionId,
    connectionState: formatLiveVideoConnectivity(results),
    internalReason: internalReason,
  );
}

Future<void> connectLiveKitRoomWithDiagnostics({
  required Room room,
  required String runtimeUrl,
  required String runtimeToken,
  required Duration connectTimeout,
  required String correlationId,
  required LiveVideoJoinFlowTracker joinFlow,
  String? sessionId,
  String? roomName,
  String? participantIdentity,
  String? urlScheme,
  String? urlHost,
  String? serverUrlLength,
  String? tokenLength,
  String? tokenFingerprint,
  String? roomInstanceId,
}) async {
  await logLiveVideoConnectivity(
    correlationId: correlationId,
    sessionId: sessionId,
    internalReason: "before_room_connect",
  );

  try {
    await room.prepareConnection(runtimeUrl, runtimeToken);
    logLiveVideoDiagnostic(
      checkpoint: LiveVideoJoinCheckpoint.roomPrepareConnectionSuccess,
      correlationId: correlationId,
      sessionId: sessionId,
      roomName: roomName,
      urlScheme: urlScheme,
      urlHost: urlHost,
      roomInstanceId: roomInstanceId,
    );
  } catch (error, stackTrace) {
    logLiveVideoDiagnostic(
      checkpoint: LiveVideoJoinCheckpoint.roomPrepareConnectionFailed,
      correlationId: correlationId,
      sessionId: sessionId,
      roomName: roomName,
      urlScheme: urlScheme,
      urlHost: urlHost,
      roomInstanceId: roomInstanceId,
      exceptionType: error.runtimeType.toString(),
      exceptionMessage: error.toString(),
      stackTraceHead: liveVideoStackTraceHead(stackTrace),
    );
  }

  joinFlow.mark(LiveVideoJoinCheckpoint.roomConnectBegin);
  logLiveVideoDiagnostic(
    checkpoint: LiveVideoJoinCheckpoint.roomConnectBegin,
    correlationId: correlationId,
    sessionId: sessionId,
    roomName: roomName,
    participantIdentity: participantIdentity,
    urlScheme: urlScheme,
    urlHost: urlHost,
    serverUrlLength: serverUrlLength,
    tokenLength: tokenLength,
    tokenFingerprint: tokenFingerprint,
    roomInstanceId: roomInstanceId,
  );

  Future<void> invokeConnect({String? internalReason}) async {
    logLiveVideoDiagnostic(
      checkpoint: LiveVideoJoinCheckpoint.roomConnectSdkInvoke,
      correlationId: correlationId,
      sessionId: sessionId,
      roomName: roomName,
      participantIdentity: participantIdentity,
      urlScheme: urlScheme,
      urlHost: urlHost,
      serverUrlLength: serverUrlLength,
      tokenLength: tokenLength,
      tokenFingerprint: tokenFingerprint,
      roomInstanceId: roomInstanceId,
      internalReason: internalReason,
    );
    await room
        .connect(
          runtimeUrl,
          runtimeToken,
          connectOptions: const ConnectOptions(autoSubscribe: false),
        )
        .timeout(
          connectTimeout,
          onTimeout: () => throw TimeoutException(
            "LiveKit connect timed out after ${connectTimeout.inSeconds}s",
          ),
        );
  }

  try {
    await invokeConnect();
  } on ConnectException catch (error) {
    if (!error.message.toLowerCase().contains("no internet")) {
      rethrow;
    }
    await logLiveVideoConnectivity(
      correlationId: correlationId,
      sessionId: sessionId,
      internalReason: "recheck_after_sdk_no_internet",
    );
    final recheck = await Connectivity().checkConnectivity();
    if (recheck.contains(ConnectivityResult.none)) {
      rethrow;
    }
    await invokeConnect(internalReason: "retry_after_false_offline");
  }
}
