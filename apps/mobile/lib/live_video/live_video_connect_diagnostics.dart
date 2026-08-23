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

const _allowedIceCandidateTypes = {"host", "srflx", "prflx", "relay"};
const _allowedIceProtocols = {"udp", "tcp"};
const _allowedIcePairStates = {
  "frozen",
  "waiting",
  "in-progress",
  "failed",
  "succeeded",
};

String? _safeIceValue(Object? value, Set<String> allowed) {
  final normalized = value?.toString().trim().toLowerCase();
  return normalized != null && allowed.contains(normalized) ? normalized : null;
}

String? _safeIceAddress(Object? value) {
  final normalized = value?.toString().trim();
  if (normalized == null || normalized.isEmpty || normalized.length > 255) {
    return null;
  }
  return RegExp(r"^[a-zA-Z0-9.:%_-]+$").hasMatch(normalized)
      ? normalized
      : null;
}

String? _safeIceNumber(Object? value, {required int max}) {
  final parsed = value is num ? value.toInt() : int.tryParse("$value");
  return parsed != null && parsed >= 0 && parsed <= max
      ? parsed.toString()
      : null;
}

List<Map<String, String>> normalizeLiveKitIceStats(
  Iterable<Object?> reports,
) {
  final normalized = <Map<String, String>>[];
  for (final report in reports) {
    final dynamic entry = report;
    final type = entry.type?.toString();
    final values = entry.values;
    if (values is! Map) continue;

    if (type == "local-candidate" || type == "remote-candidate") {
      final candidateType = _safeIceValue(
        values["candidateType"],
        _allowedIceCandidateTypes,
      );
      final protocol = _safeIceValue(values["protocol"], _allowedIceProtocols);
      final address = _safeIceAddress(values["address"] ?? values["ip"]);
      final port = _safeIceNumber(values["port"], max: 65535);
      final priority = _safeIceNumber(values["priority"], max: 0xffffffff);
      normalized.add({
        "kind": "candidate",
        "direction": type == "local-candidate" ? "local" : "remote",
        if (candidateType != null) "candidateType": candidateType,
        if (protocol != null) "protocol": protocol,
        if (address != null) "address": address,
        if (port != null) "port": port,
        if (priority != null) "priority": priority,
      });
      continue;
    }

    if (type == "candidate-pair") {
      final state = _safeIceValue(values["state"], _allowedIcePairStates);
      final selected =
          values["selected"] == true || values["nominated"] == true;
      normalized.add({
        "kind": "pair",
        if (state != null) "state": state,
        "selected": selected.toString(),
      });
    }
  }
  return normalized;
}

List<Map<String, String>> normalizeLiveKitIceSdp(
  String? sdp, {
  required String direction,
}) {
  if (sdp == null || sdp.isEmpty) return const [];
  final candidates = <Map<String, String>>[];
  for (final rawLine in sdp.split(RegExp(r"\r?\n"))) {
    final line = rawLine.trim();
    if (!line.startsWith("a=candidate:") && !line.startsWith("candidate:")) {
      continue;
    }
    final fields = line.replaceFirst("a=", "").split(RegExp(r"\s+"));
    if (fields.length < 8 || fields[6].toLowerCase() != "typ") continue;
    final candidateType = _safeIceValue(fields[7], _allowedIceCandidateTypes);
    final protocol = _safeIceValue(fields[2], _allowedIceProtocols);
    final priority = _safeIceNumber(fields[3], max: 0xffffffff);
    final address = _safeIceAddress(fields[4]);
    final port = _safeIceNumber(fields[5], max: 65535);
    candidates.add({
      "kind": "candidate",
      "direction": direction,
      if (candidateType != null) "candidateType": candidateType,
      if (protocol != null) "protocol": protocol,
      if (address != null) "address": address,
      if (port != null) "port": port,
      if (priority != null) "priority": priority,
    });
  }
  return candidates;
}

void _logNormalizedIceRecord({
  required Map<String, String> stat,
  required String transport,
  required Set<String> seen,
  required String correlationId,
  String? sessionId,
  String? connectionAttemptId,
}) {
  final fingerprint =
      "$transport:${stat.entries.map((e) => "${e.key}=${e.value}").join("|")}";
  if (!seen.add(fingerprint)) return;
  final isCandidate = stat["kind"] == "candidate";
  logLiveVideoDiagnostic(
    checkpoint: isCandidate
        ? LiveVideoJoinCheckpoint.iceCandidateObserved
        : LiveVideoJoinCheckpoint.iceCandidatePairObserved,
    correlationId: correlationId,
    sessionId: sessionId,
    connectionAttemptId: connectionAttemptId,
    iceTransport: transport,
    iceCandidateDirection: stat["direction"],
    iceCandidateType: stat["candidateType"],
    iceProtocol: stat["protocol"],
    iceAddress: stat["address"],
    icePort: stat["port"],
    icePriority: stat["priority"],
    icePairState: stat["state"],
    icePairSelected: stat["selected"],
  );
}

Future<void> _logLiveKitIceStats({
  required Room room,
  required Set<String> seen,
  required String correlationId,
  String? sessionId,
  String? connectionAttemptId,
}) async {
  // LiveKit does not expose candidate-pair diagnostics through its public Room
  // API. This read-only access is deliberately isolated so it can be removed
  // once the SDK exposes equivalent supported diagnostics.
  // ignore: invalid_use_of_internal_member
  final transports = <String, dynamic>{
    // ignore: invalid_use_of_internal_member
    "publisher": room.engine.publisher,
    // ignore: invalid_use_of_internal_member
    "subscriber": room.engine.subscriber,
  };

  for (final transportEntry in transports.entries) {
    final transport = transportEntry.value;
    if (transport == null) continue;
    try {
      final reports = await transport.pc.getStats() as Iterable<Object?>;
      for (final stat in normalizeLiveKitIceStats(reports)) {
        _logNormalizedIceRecord(
          stat: stat,
          transport: transportEntry.key,
          seen: seen,
          correlationId: correlationId,
          sessionId: sessionId,
          connectionAttemptId: connectionAttemptId,
        );
      }
      final localDescription = await transport.pc.getLocalDescription();
      final remoteDescription = await transport.pc.getRemoteDescription();
      for (final stat in normalizeLiveKitIceSdp(
        localDescription?.sdp,
        direction: "local",
      )) {
        _logNormalizedIceRecord(
          stat: stat,
          transport: transportEntry.key,
          seen: seen,
          correlationId: correlationId,
          sessionId: sessionId,
          connectionAttemptId: connectionAttemptId,
        );
      }
      for (final stat in normalizeLiveKitIceSdp(
        remoteDescription?.sdp,
        direction: "remote",
      )) {
        _logNormalizedIceRecord(
          stat: stat,
          transport: transportEntry.key,
          seen: seen,
          correlationId: correlationId,
          sessionId: sessionId,
          connectionAttemptId: connectionAttemptId,
        );
      }
    } catch (error) {
      final fingerprint =
          "${transportEntry.key}:unavailable:${error.runtimeType}";
      if (seen.add(fingerprint)) {
        logLiveVideoDiagnostic(
          checkpoint: LiveVideoJoinCheckpoint.iceStatsUnavailable,
          correlationId: correlationId,
          sessionId: sessionId,
          connectionAttemptId: connectionAttemptId,
          iceTransport: transportEntry.key,
          exceptionType: error.runtimeType.toString(),
        );
      }
    }
  }
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
  String? connectionAttemptId,
  bool Function()? isAttemptActive,
}) async {
  await logLiveVideoConnectivity(
    correlationId: correlationId,
    sessionId: sessionId,
    internalReason: "before_room_connect",
  );

  void guardAttempt(String stage) {
    if (isAttemptActive != null && !isAttemptActive()) {
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.staleAttemptIgnored,
        correlationId: correlationId,
        sessionId: sessionId,
        connectionAttemptId: connectionAttemptId,
        internalReason: stage,
      );
      throw StateError("Stale connection attempt at $stage");
    }
  }

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
    guardAttempt("before_connect_invoke");
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
      connectionAttemptId: connectionAttemptId,
      internalReason: internalReason,
    );
    final seenIceStats = <String>{};
    var iceStatsProbeRunning = false;
    final iceProbeTimer = Timer.periodic(const Duration(seconds: 2), (_) async {
      if (isAttemptActive != null && !isAttemptActive()) return;
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.roomConnectSdkInvoke,
        correlationId: correlationId,
        sessionId: sessionId,
        roomName: roomName,
        roomInstanceId: roomInstanceId,
        connectionAttemptId: connectionAttemptId,
        connectionState: room.connectionState.name,
        internalReason: "ice_connect_probe",
      );
      if (iceStatsProbeRunning) return;
      iceStatsProbeRunning = true;
      try {
        await _logLiveKitIceStats(
          room: room,
          seen: seenIceStats,
          correlationId: correlationId,
          sessionId: sessionId,
          connectionAttemptId: connectionAttemptId,
        );
      } finally {
        iceStatsProbeRunning = false;
      }
    });
    try {
      await room
          .connect(
        runtimeUrl,
        runtimeToken,
        connectOptions: const ConnectOptions(autoSubscribe: false),
      )
          .timeout(
        connectTimeout,
        onTimeout: () {
          logLiveVideoDiagnostic(
            checkpoint: LiveVideoJoinCheckpoint.timeoutFired,
            correlationId: correlationId,
            sessionId: sessionId,
            connectionAttemptId: connectionAttemptId,
            timeoutName: "room_connect",
            timeoutDurationMs: connectTimeout.inMilliseconds.toString(),
          );
          throw TimeoutException(
            "LiveKit connect timed out after ${connectTimeout.inSeconds}s",
          );
        },
      );
      guardAttempt("after_connect_success");
    } finally {
      iceProbeTimer.cancel();
      await _logLiveKitIceStats(
        room: room,
        seen: seenIceStats,
        correlationId: correlationId,
        sessionId: sessionId,
        connectionAttemptId: connectionAttemptId,
      );
    }
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
