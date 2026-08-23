/// Structured checkpoints for proving whether [Room.connect] executes.
abstract final class LiveVideoJoinCheckpoint {
  static const startStreamBegin = "START_STREAM_BEGIN";
  static const startRequestSent = "START_REQUEST_SENT";
  static const startResponseReceived = "START_RESPONSE_RECEIVED";
  static const sessionParsed = "SESSION_PARSED";
  static const connectPublisherInvoked = "CONNECT_PUBLISHER_INVOKED";
  static const roomCreated = "ROOM_CREATED";
  static const connectivityChecked = "CONNECTIVITY_CHECKED";
  static const roomPrepareConnectionSuccess = "ROOM_PREPARE_CONNECTION_SUCCESS";
  static const roomPrepareConnectionFailed = "ROOM_PREPARE_CONNECTION_FAILED";
  static const roomConnectBegin = "ROOM_CONNECT_BEGIN";
  static const roomConnectSdkInvoke = "ROOM_CONNECT_SDK_INVOKE";
  static const roomConnectSuccess = "ROOM_CONNECT_SUCCESS";
  static const roomConnectException = "ROOM_CONNECT_EXCEPTION";
  static const localVideoCreateBegin = "LOCAL_VIDEO_CREATE_BEGIN";
  static const localVideoCreateSuccess = "LOCAL_VIDEO_CREATE_SUCCESS";
  static const localAudioCreateBegin = "LOCAL_AUDIO_CREATE_BEGIN";
  static const localAudioCreateSuccess = "LOCAL_AUDIO_CREATE_SUCCESS";
  static const tracksPublished = "TRACKS_PUBLISHED";
  static const joinFlowInterrupted = "JOIN_FLOW_INTERRUPTED_BEFORE_CONNECT";
  static const lifecycleTransition = "LIFECYCLE_TRANSITION";
  static const disconnectRequested = "DISCONNECT_REQUESTED";
  static const disconnectCompleted = "DISCONNECT_COMPLETED";
  static const staleAttemptIgnored = "STALE_ATTEMPT_IGNORED";
  static const operationSerialized = "OPERATION_SERIALIZED";
  static const timeoutFired = "TIMEOUT_FIRED";
  static const iceCandidateObserved = "ICE_CANDIDATE_OBSERVED";
  static const iceCandidatePairObserved = "ICE_CANDIDATE_PAIR_OBSERVED";
  static const iceStatsUnavailable = "ICE_STATS_UNAVAILABLE";
}

/// Tracks join-flow checkpoints for post-mortem diagnostics.
class LiveVideoJoinFlowTracker {
  final Set<String> _checkpoints = <String>{};
  String? interruptReason;
  String? interruptLocation;
  String? activeConnectionAttemptId;

  Iterable<String> get checkpoints => _checkpoints;

  bool get roomConnectBeginLogged =>
      _checkpoints.contains(LiveVideoJoinCheckpoint.roomConnectBegin);

  bool get roomConnectSuccessLogged =>
      _checkpoints.contains(LiveVideoJoinCheckpoint.roomConnectSuccess);

  void reset({String? connectionAttemptId}) {
    _checkpoints.clear();
    interruptReason = null;
    interruptLocation = null;
    activeConnectionAttemptId = connectionAttemptId;
  }

  void bindAttempt(String connectionAttemptId) {
    activeConnectionAttemptId = connectionAttemptId;
  }

  void mark(String checkpoint) {
    _checkpoints.add(checkpoint);
  }

  void recordInterrupt({required String reason, required String location}) {
    interruptReason = reason;
    interruptLocation = location;
    mark(LiveVideoJoinCheckpoint.joinFlowInterrupted);
  }

  Map<String, Object?> toDiagnosticMap() => {
        "checkpoints": _checkpoints.toList()..sort(),
        if (activeConnectionAttemptId != null)
          "activeConnectionAttemptId": activeConnectionAttemptId,
        if (interruptReason != null) "interruptReason": interruptReason,
        if (interruptLocation != null) "interruptLocation": interruptLocation,
        "roomConnectBeginLogged": roomConnectBeginLogged,
        "roomConnectSuccessLogged": roomConnectSuccessLogged,
      };
}
