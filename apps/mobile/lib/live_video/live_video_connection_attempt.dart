/// Identity and timing for one live video connect/publish cycle.
class LiveVideoConnectionAttempt {
  LiveVideoConnectionAttempt({
    required this.connectionAttemptId,
    required this.controllerGeneration,
    required this.startedAt,
    this.incidentId,
    this.liveVideoSessionId,
    this.roomName = "",
    this.participantIdentity = "",
    this.tokenFingerprint,
    this.roomInstanceId,
  });

  final String connectionAttemptId;
  final int controllerGeneration;
  final DateTime startedAt;
  String? incidentId;
  String? liveVideoSessionId;
  String roomName;
  String participantIdentity;
  String? tokenFingerprint;
  int? roomInstanceId;
  DateTime? connectedAt;
  DateTime? publishedAt;
  DateTime? disconnectRequestedAt;
  DateTime? disposedAt;

  Map<String, Object?> toDiagnosticMap() => {
        "connectionAttemptId": connectionAttemptId,
        "controllerGeneration": controllerGeneration,
        "incidentId": incidentId,
        "liveVideoSessionId": liveVideoSessionId,
        "roomName": roomName,
        "participantIdentity": participantIdentity,
        if (tokenFingerprint != null) "tokenFingerprint": tokenFingerprint,
        if (roomInstanceId != null) "roomInstanceId": roomInstanceId.toString(),
        "startedAt": startedAt.toIso8601String(),
        if (connectedAt != null) "connectedAt": connectedAt!.toIso8601String(),
        if (publishedAt != null) "publishedAt": publishedAt!.toIso8601String(),
        if (disconnectRequestedAt != null)
          "disconnectRequestedAt": disconnectRequestedAt!.toIso8601String(),
        if (disposedAt != null) "disposedAt": disposedAt!.toIso8601String(),
      };
}

/// Generates monotonic attempt IDs and generation counters.
class LiveVideoAttemptFactory {
  int _sequence = 0;
  int controllerGeneration = 0;

  LiveVideoConnectionAttempt create({String? incidentId}) {
    _sequence += 1;
    controllerGeneration += 1;
    final id =
        "lv-${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}-$_sequence";
    return LiveVideoConnectionAttempt(
      connectionAttemptId: id,
      controllerGeneration: controllerGeneration,
      startedAt: DateTime.now().toUtc(),
      incidentId: incidentId,
    );
  }
}
