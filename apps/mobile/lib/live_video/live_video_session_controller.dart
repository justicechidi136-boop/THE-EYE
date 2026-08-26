import "dart:async";

import "package:flutter/foundation.dart";
import "package:livekit_client/livekit_client.dart";

import "../evidence/evidence_permission_service.dart";
import "../evidence/evidence_permission_state.dart";
import "live_video_api_models.dart";
import "live_video_connect_diagnostics.dart";
import "live_video_connection_attempt.dart";
import "live_video_connection_state.dart";
import "live_video_disconnect_source.dart";
import "live_video_error_codes.dart";
import "live_video_join_flow.dart";
import "live_video_lifecycle_phase.dart";
import "live_video_operation_lock.dart";
import "live_video_safe_log.dart";
import "live_video_start_validation.dart";

class LiveVideoPermissionOutcome {
  const LiveVideoPermissionOutcome({required this.granted, this.message});

  final bool granted;
  final String? message;
}

class LiveVideoSessionController extends ChangeNotifier {
  LiveVideoSessionController({
    EvidencePermissionService? permissionService,
    this.audioOnly = false,
  }) : _permissionService = permissionService ?? EvidencePermissionService();

  static const connectTimeout = Duration(seconds: 30);

  final EvidencePermissionService _permissionService;
  final bool audioOnly;
  final LiveVideoJoinFlowTracker joinFlow = LiveVideoJoinFlowTracker();
  final LiveVideoLifecycleStateMachine _lifecycle =
      LiveVideoLifecycleStateMachine();
  final LiveVideoAttemptFactory _attemptFactory = LiveVideoAttemptFactory();
  final LiveVideoOperationLock _operationLock = LiveVideoOperationLock();

  Room? _room;
  LocalVideoTrack? _localVideoTrack;
  LocalAudioTrack? _localAudioTrack;
  EventsListener<RoomEvent>? _roomListener;
  LiveKitCredentials? _credentials;
  String _participantIdentity = "";
  int? _activeRoomInstanceId;
  LiveVideoConnectionAttempt? _activeAttempt;
  Future<void>? _lastStopFuture;

  bool _lowBandwidth = true;
  bool _muted = false;
  bool _cameraEnabled = true;
  bool _disposing = false;
  bool _reconnectInFlight = false;
  bool _previewActive = false;

  LiveVideoConnectionState connectionState = LiveVideoConnectionState.idle;
  LiveVideoLifecyclePhase get lifecyclePhase => _lifecycle.phase;
  String? get activeConnectionAttemptId => _activeAttempt?.connectionAttemptId;
  int get controllerGeneration => _attemptFactory.controllerGeneration;
  bool get canStartSession => _lifecycle.phase.allowsStart && !_disposing;
  bool get canStopSession => _lifecycle.phase.allowsStop && !_disposing;

  /// User-facing hint when [canStartSession] is false during preview or connect.
  String? get startUnavailableReason {
    switch (_lifecycle.phase) {
      case LiveVideoLifecyclePhase.preparing:
        return "Preparing camera...";
      case LiveVideoLifecyclePhase.connecting:
      case LiveVideoLifecyclePhase.publishing:
        return "Starting live video...";
      default:
        return null;
    }
  }

  /// Test-only hooks for lifecycle verification without WebRTC hardware.
  @visibleForTesting
  void debugForceLifecycle(LiveVideoLifecyclePhase phase) {
    _lifecycle.forceTransition(phase);
    connectionState = phase.toConnectionState(previewActive: _previewActive);
    notifyListeners();
  }

  @visibleForTesting
  String debugBeginAttempt({String? incidentIdOverride}) {
    final attempt = _attemptFactory.create(incidentId: incidentIdOverride);
    _activeAttempt = attempt;
    joinFlow.bindAttempt(attempt.connectionAttemptId);
    return attempt.connectionAttemptId;
  }

  @visibleForTesting
  bool debugIsAttemptActive(String attemptId) =>
      _activeAttempt?.connectionAttemptId == attemptId && !_disposing;

  String? errorMessage;
  String roomName = "";
  String sessionId = "";
  String incidentId = "";
  String correlationId = "";
  String? lastConnectFailureReason;
  String? lastConnectExceptionType;
  String? lastConnectExceptionMessage;
  String? lastConnectStackTraceHead;
  bool recordingConfigured = false;
  Map<String, dynamic>? evidenceOverlayRaw;

  LocalVideoTrack? get localVideoTrack => _localVideoTrack;
  Room? get room => _room;
  bool get isMuted => _muted;
  bool get isCameraEnabled => _cameraEnabled;
  bool get isStreaming => _lifecycle.phase == LiveVideoLifecyclePhase.streaming;

  bool _isAttemptActive(LiveVideoConnectionAttempt attempt) =>
      !_disposing &&
      _activeAttempt?.connectionAttemptId == attempt.connectionAttemptId;

  void _logDisconnect({
    required LiveVideoDisconnectReason reason,
    required String caller,
    LiveVideoConnectionAttempt? attempt,
    Room? room,
    String checkpoint = LiveVideoJoinCheckpoint.disconnectRequested,
  }) {
    logLiveVideoDiagnostic(
      checkpoint: checkpoint,
      correlationId: correlationId,
      incidentId: incidentId,
      sessionId: sessionId,
      connectionAttemptId: attempt?.connectionAttemptId,
      roomInstanceId: room == null ? null : identityHashCode(room).toString(),
      lifecyclePhase: _lifecycle.phase.name,
      controllerGeneration: _attemptFactory.controllerGeneration.toString(),
      disconnectReason: reason.code,
      disconnectCaller: caller,
      connectionState: connectionState.name,
    );
  }

  void _transitionLifecycle(
    LiveVideoLifecyclePhase next, {
    String? message,
    required String caller,
  }) {
    final previous = _lifecycle.phase;
    if (!_lifecycle.tryTransition(next)) {
      _lifecycle.forceTransition(next);
    }
    connectionState = next.toConnectionState(previewActive: _previewActive);
    if (message != null) errorMessage = message;
    logLiveVideoDiagnostic(
      checkpoint: LiveVideoJoinCheckpoint.lifecycleTransition,
      correlationId: correlationId,
      incidentId: incidentId,
      sessionId: sessionId,
      connectionAttemptId: _activeAttempt?.connectionAttemptId,
      lifecyclePhase: next.name,
      controllerGeneration: _attemptFactory.controllerGeneration.toString(),
      internalReason: "$previous->$next",
      disconnectCaller: caller,
      connectionState: connectionState.name,
    );
    if (!_disposing) {
      notifyListeners();
    }
  }

  Future<LiveVideoPermissionOutcome> ensurePermissions() async {
    var camera = EvidencePermissionState.granted;
    if (!audioOnly) {
      camera = await _permissionService.cameraState();
      if (camera == EvidencePermissionState.notRequested ||
          camera == EvidencePermissionState.denied) {
        camera = await _permissionService.requestCamera();
      }
    }
    var microphone = await _permissionService.microphoneState();
    if (microphone == EvidencePermissionState.notRequested ||
        microphone == EvidencePermissionState.denied) {
      microphone = await _permissionService.requestMicrophone();
    }

    if (camera == EvidencePermissionState.granted &&
        microphone == EvidencePermissionState.granted) {
      return const LiveVideoPermissionOutcome(granted: true);
    }
    if (camera != EvidencePermissionState.granted &&
        microphone == EvidencePermissionState.granted) {
      return LiveVideoPermissionOutcome(
        granted: false,
        message: "Camera permission is required for live emergency video. "
            "Reference: ${LiveVideoErrorCodes.cameraPermissionDenied}.",
      );
    }
    if (camera == EvidencePermissionState.granted &&
        microphone != EvidencePermissionState.granted) {
      return LiveVideoPermissionOutcome(
        granted: false,
        message: "Microphone permission is required for this live broadcast. "
            "Reference: ${LiveVideoErrorCodes.microphonePermissionDenied}.",
      );
    }
    if (camera == EvidencePermissionState.permanentlyDenied ||
        microphone == EvidencePermissionState.permanentlyDenied) {
      return LiveVideoPermissionOutcome(
        granted: false,
        message:
            "Enable the required microphone permission in device settings to start this live broadcast. "
            "Reference: ${LiveVideoErrorCodes.cameraPermissionDenied}.",
      );
    }
    if (camera == EvidencePermissionState.restricted ||
        microphone == EvidencePermissionState.restricted) {
      return const LiveVideoPermissionOutcome(
        granted: false,
        message: "Required microphone access is restricted on this device.",
      );
    }
    return const LiveVideoPermissionOutcome(
      granted: false,
      message: "Microphone permission is required for this live broadcast.",
    );
  }

  Future<bool> startLocalPreview({bool lowBandwidth = true}) async {
    if (_lifecycle.phase.isActive ||
        _lifecycle.phase == LiveVideoLifecyclePhase.stopping) {
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.staleAttemptIgnored,
        lifecyclePhase: _lifecycle.phase.name,
        internalReason: "preview_blocked_during_active_session",
        disconnectCaller: "startLocalPreview",
      );
      return _previewActive && _localVideoTrack != null;
    }

    return _operationLock.run(() async {
      _lowBandwidth = lowBandwidth;
      _transitionLifecycle(
        LiveVideoLifecyclePhase.preparing,
        caller: "startLocalPreview",
      );

      final permissions = await ensurePermissions();
      if (_disposing || _lifecycle.phase == LiveVideoLifecyclePhase.stopping) {
        return false;
      }
      if (!permissions.granted) {
        _transitionLifecycle(
          LiveVideoLifecyclePhase.connectFailed,
          message: permissions.message,
          caller: "startLocalPreview:permission_denied",
        );
        return false;
      }

      try {
        await _disposeTracks(caller: "startLocalPreview");
        await _createPreviewVideoTrack(caller: "startLocalPreview");
        _previewActive = true;
        _transitionLifecycle(
          LiveVideoLifecyclePhase.stopped,
          caller: "startLocalPreview:ready",
        );
        return true;
      } catch (error, stackTrace) {
        logLiveVideoDiagnostic(
          checkpoint: LiveVideoJoinCheckpoint.localVideoCreateBegin,
          exceptionType: error.runtimeType.toString(),
          exceptionMessage: error.toString(),
          stackTraceHead: liveVideoStackTraceHead(stackTrace),
          internalReason: "LOCAL_VIDEO_CREATE_FAILED",
        );
        _transitionLifecycle(
          LiveVideoLifecyclePhase.connectFailed,
          message: "Unable to start camera preview ($error).",
          caller: "startLocalPreview:error",
        );
        return false;
      }
    });
  }

  /// Serialized public entry for Start / Retry from UI.
  Future<bool> startSession(
    LiveVideoStartResult startResult, {
    String? incidentIdOverride,
  }) {
    return _operationLock.run(() async {
      await (_lastStopFuture ?? Future<void>.value());
      if (!canStartSession) {
        joinFlow.recordInterrupt(
          reason: "start_blocked_lifecycle_${_lifecycle.phase.name}",
          location: "startSession:lifecycle_guard",
        );
        return false;
      }
      return _connectPublisherForAttempt(
        startResult,
        incidentIdOverride: incidentIdOverride,
      );
    });
  }

  /// Backward-compatible alias.
  Future<bool> connectPublisher(LiveVideoStartResult startResult) =>
      startSession(startResult);

  Future<bool> _connectPublisherForAttempt(
    LiveVideoStartResult startResult, {
    String? incidentIdOverride,
  }) async {
    final attempt = _attemptFactory.create(
      incidentId: incidentIdOverride ?? incidentId,
    );
    _activeAttempt = attempt;
    joinFlow.reset(connectionAttemptId: attempt.connectionAttemptId);

    correlationId = startResult.correlationId;
    incidentId = incidentIdOverride ?? incidentId;
    lastConnectFailureReason = null;
    lastConnectExceptionType = null;
    lastConnectExceptionMessage = null;
    lastConnectStackTraceHead = null;

    _credentials = startResult.livekit;
    _participantIdentity = startResult.participantIdentity;
    roomName = startResult.roomName;
    sessionId = startResult.sessionId;
    attempt
      ..incidentId = incidentId
      ..liveVideoSessionId = sessionId
      ..roomName = roomName
      ..participantIdentity = _participantIdentity
      ..tokenFingerprint =
          liveVideoTokenFingerprint(startResult.livekit.token.trim());

    recordingConfigured = startResult.recordingConfigured;
    evidenceOverlayRaw = startResult.evidenceOverlay;

    _transitionLifecycle(
      LiveVideoLifecyclePhase.connecting,
      caller: "startSession",
    );
    joinFlow.mark(LiveVideoJoinCheckpoint.connectPublisherInvoked);

    final runtimeUrl = _credentials!.url.trim();
    final runtimeToken = _credentials!.token.trim();
    final runtimeRoomName = roomName.trim();
    final runtimeIdentity = _participantIdentity.trim();
    final uri = liveVideoUrlHost(runtimeUrl);

    logLiveVideoDiagnostic(
      checkpoint: LiveVideoJoinCheckpoint.sessionParsed,
      correlationId: correlationId,
      incidentId: incidentId,
      sessionId: sessionId,
      connectionAttemptId: attempt.connectionAttemptId,
      roomName: runtimeRoomName,
      participantIdentity: runtimeIdentity,
      urlScheme: uri?.scheme,
      urlHost: uri?.host,
      serverUrlLength: runtimeUrl.length.toString(),
      tokenLength: runtimeToken.length.toString(),
      tokenFingerprint: attempt.tokenFingerprint,
      controllerGeneration: attempt.controllerGeneration.toString(),
      connectionState: connectionState.name,
      lifecyclePhase: _lifecycle.phase.name,
    );

    if (runtimeUrl.isEmpty || runtimeToken.isEmpty || runtimeRoomName.isEmpty) {
      joinFlow.recordInterrupt(
        reason: "empty_runtime_connect_inputs",
        location: "connectPublisher:preconnect_validation",
      );
      _failBeforeConnect(
        attempt,
        "Live video connect inputs were empty at runtime "
        "(urlEmpty=${runtimeUrl.isEmpty}, tokenEmpty=${runtimeToken.isEmpty}, "
        "roomEmpty=${runtimeRoomName.isEmpty}).",
      );
      return false;
    }

    if (_disposing) {
      joinFlow.recordInterrupt(
        reason: "controller_disposing",
        location: "connectPublisher:disposing_guard",
      );
      _failBeforeConnect(
        attempt,
        "Live video controller is disposing before Room.connect.",
      );
      return false;
    }

    try {
      await _cleanupOwnedRoom(
        reason: LiveVideoDisconnectReason.retryReplacement,
        caller: "connectPublisher:preconnect_cleanup",
        attempt: attempt,
      );
      await _preparePublisherTracks(
        attempt: attempt,
        correlationId: correlationId,
        sessionId: sessionId,
      );
    } catch (error, stackTrace) {
      if (!_isAttemptActive(attempt)) return false;
      lastConnectFailureReason = LiveVideoErrorCodes.publishTracksFailed;
      lastConnectExceptionType = error.runtimeType.toString();
      lastConnectExceptionMessage = error.toString();
      lastConnectStackTraceHead = liveVideoStackTraceHead(stackTrace);
      _transitionLifecycle(
        LiveVideoLifecyclePhase.publishFailed,
        message: "Unable to prepare camera/microphone for live video ($error). "
            "Reference: ${LiveVideoErrorCodes.publishTracksFailed}.",
        caller: "connectPublisher:prepare_tracks",
      );
      return false;
    }

    if (!_isAttemptActive(attempt)) return false;

    final room = Room(
      roomOptions: RoomOptions(
        adaptiveStream: true,
        dynacast: true,
        defaultAudioPublishOptions: AudioPublishOptions(dtx: _lowBandwidth),
        defaultVideoPublishOptions: VideoPublishOptions(
          simulcast: !_lowBandwidth,
          videoEncoding: VideoEncoding(
            maxBitrate: _lowBandwidth ? 120000 : 800000,
            maxFramerate: _lowBandwidth ? 15 : 30,
          ),
        ),
      ),
    );
    final roomInstanceId = identityHashCode(room);
    attempt.roomInstanceId = roomInstanceId;
    _room = room;
    _activeRoomInstanceId = roomInstanceId;
    _bindRoomEvents(room, attempt);

    logLiveVideoDiagnostic(
      checkpoint: LiveVideoJoinCheckpoint.roomCreated,
      correlationId: correlationId,
      sessionId: sessionId,
      connectionAttemptId: attempt.connectionAttemptId,
      roomName: runtimeRoomName,
      participantIdentity: runtimeIdentity,
      roomInstanceId: roomInstanceId.toString(),
      controllerGeneration: attempt.controllerGeneration.toString(),
    );

    try {
      await connectLiveKitRoomWithDiagnostics(
        room: room,
        runtimeUrl: runtimeUrl,
        runtimeToken: runtimeToken,
        connectTimeout: connectTimeout,
        correlationId: correlationId,
        joinFlow: joinFlow,
        sessionId: sessionId,
        roomName: runtimeRoomName,
        participantIdentity: runtimeIdentity,
        urlScheme: uri?.scheme,
        urlHost: uri?.host,
        serverUrlLength: runtimeUrl.length.toString(),
        tokenLength: runtimeToken.length.toString(),
        tokenFingerprint: attempt.tokenFingerprint,
        roomInstanceId: roomInstanceId.toString(),
        connectionAttemptId: attempt.connectionAttemptId,
        isAttemptActive: () => _isAttemptActive(attempt),
      );

      if (!_isAttemptActive(attempt) ||
          !identical(_room, room) ||
          _activeRoomInstanceId != roomInstanceId) {
        throw StateError(
          "Stale connect completion "
          "(attempt=${attempt.connectionAttemptId}, "
          "room=${identical(_room, room)}, gen=${attempt.controllerGeneration})",
        );
      }

      attempt.connectedAt = DateTime.now().toUtc();
      _transitionLifecycle(
        LiveVideoLifecyclePhase.connected,
        caller: "connectPublisher:room_connected",
      );
      joinFlow.mark(LiveVideoJoinCheckpoint.roomConnectSuccess);
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.roomConnectSuccess,
        correlationId: correlationId,
        sessionId: sessionId,
        connectionAttemptId: attempt.connectionAttemptId,
        roomName: runtimeRoomName,
        participantIdentity: runtimeIdentity,
        roomInstanceId: roomInstanceId.toString(),
        connectionState: room.connectionState.name,
      );
    } catch (error, stackTrace) {
      if (!_isAttemptActive(attempt)) return false;
      joinFlow.mark(LiveVideoJoinCheckpoint.roomConnectException);
      lastConnectFailureReason = LiveVideoErrorCodes.connectLivekitFailed;
      lastConnectExceptionType = error.runtimeType.toString();
      lastConnectExceptionMessage =
          formatLiveKitConnectException(error) ?? error.toString();
      lastConnectStackTraceHead = liveVideoStackTraceHead(stackTrace);
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.roomConnectException,
        correlationId: correlationId,
        sessionId: sessionId,
        connectionAttemptId: attempt.connectionAttemptId,
        roomName: runtimeRoomName,
        participantIdentity: runtimeIdentity,
        exceptionType: lastConnectExceptionType,
        exceptionMessage: lastConnectExceptionMessage,
        stackTraceHead: lastConnectStackTraceHead,
        internalReason: lastConnectFailureReason,
      );
      if (kDebugMode) {
        debugPrintStack(
            stackTrace: stackTrace, label: "live_video_room_connect");
      }
      final code = LiveVideoErrorCodes.connectLivekitFailed;
      _transitionLifecycle(
        LiveVideoLifecyclePhase.connectFailed,
        message: error is TimeoutException
            ? "Live video connection timed out. Check network and try again. "
                "($lastConnectExceptionType: $lastConnectExceptionMessage) "
                "Reference: $code."
            : "Unable to join the live video room "
                "($lastConnectExceptionType: $lastConnectExceptionMessage). "
                "Reference: $code.",
        caller: "connectPublisher:connect_failed",
      );
      await _cleanupOwnedRoom(
        room: room,
        roomInstanceId: roomInstanceId,
        attempt: attempt,
        reason: LiveVideoDisconnectReason.connectFailed,
        caller: "connectPublisher:connect_failed_cleanup",
      );
      return false;
    }

    if (!_isAttemptActive(attempt)) return false;

    _transitionLifecycle(
      LiveVideoLifecyclePhase.publishing,
      caller: "connectPublisher:publish_begin",
    );

    try {
      await _ensureLocalAudioTrack(
        attempt: attempt,
        correlationId: correlationId,
        sessionId: sessionId,
      );
      if (!_isAttemptActive(attempt)) return false;

      final participant = room.localParticipant;
      if (participant == null) {
        throw StateError("Local participant unavailable after room connect");
      }

      if (_localVideoTrack != null) {
        await participant.publishVideoTrack(_localVideoTrack!);
      }
      await participant.publishAudioTrack(_localAudioTrack!);
      await participant.setMicrophoneEnabled(!_muted);
      if (!audioOnly) {
        await participant.setCameraEnabled(_cameraEnabled);
      }

      attempt.publishedAt = DateTime.now().toUtc();
      _previewActive = true;
      _transitionLifecycle(
        LiveVideoLifecyclePhase.streaming,
        caller: "connectPublisher:streaming",
      );
      joinFlow.mark(LiveVideoJoinCheckpoint.tracksPublished);
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.tracksPublished,
        correlationId: correlationId,
        sessionId: sessionId,
        connectionAttemptId: attempt.connectionAttemptId,
        roomName: runtimeRoomName,
        roomInstanceId: roomInstanceId.toString(),
        connectionState: connectionState.name,
        cameraState: _cameraEnabled ? "enabled" : "disabled",
        microphoneState: _muted ? "muted" : "live",
      );
      return true;
    } catch (error, stackTrace) {
      if (!_isAttemptActive(attempt)) return false;
      lastConnectFailureReason = LiveVideoErrorCodes.publishTracksFailed;
      lastConnectExceptionType = error.runtimeType.toString();
      lastConnectExceptionMessage = error.toString();
      lastConnectStackTraceHead = liveVideoStackTraceHead(stackTrace);
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.tracksPublished,
        correlationId: correlationId,
        sessionId: sessionId,
        connectionAttemptId: attempt.connectionAttemptId,
        roomName: runtimeRoomName,
        roomInstanceId: roomInstanceId.toString(),
        exceptionType: lastConnectExceptionType,
        exceptionMessage: lastConnectExceptionMessage,
        stackTraceHead: lastConnectStackTraceHead,
        internalReason: lastConnectFailureReason,
      );
      if (kDebugMode) {
        debugPrintStack(
            stackTrace: stackTrace, label: "live_video_track_publish");
      }
      _transitionLifecycle(
        LiveVideoLifecyclePhase.publishFailed,
        message:
            "Connected to live video but could not publish camera/microphone "
            "($lastConnectExceptionType: $lastConnectExceptionMessage). "
            "Reference: ${LiveVideoErrorCodes.publishTracksFailed}.",
        caller: "connectPublisher:publish_failed",
      );
      await _cleanupOwnedRoom(
        room: room,
        roomInstanceId: roomInstanceId,
        attempt: attempt,
        reason: LiveVideoDisconnectReason.publishFailed,
        caller: "connectPublisher:publish_failed_cleanup",
      );
      await _disposeAudioTrack(caller: "connectPublisher:publish_failed");
      await _disposeVideoTrack(caller: "connectPublisher:publish_failed");
      return false;
    }
  }

  void _failBeforeConnect(LiveVideoConnectionAttempt attempt, String message) {
    lastConnectFailureReason =
        LiveVideoErrorCodes.joinFlowInterruptedBeforeConnect;
    lastConnectExceptionType = "JoinFlowInterrupted";
    lastConnectExceptionMessage = message;
    _transitionLifecycle(
      LiveVideoLifecyclePhase.connectFailed,
      message:
          "$message Reference: ${LiveVideoErrorCodes.joinFlowInterruptedBeforeConnect}.",
      caller: "connectPublisher:fail_before_connect",
    );
  }

  /// Serialized public entry for Stop from UI.
  Future<void> stopSession({
    bool keepPreview = false,
    LiveVideoDisconnectReason reason = LiveVideoDisconnectReason.userStop,
    String caller = "stopSession",
  }) {
    final future = _operationLock.run(() async {
      if (_lifecycle.phase == LiveVideoLifecyclePhase.idle &&
          _room == null &&
          !_previewActive) {
        return;
      }
      _transitionLifecycle(
        LiveVideoLifecyclePhase.stopping,
        caller: "$caller:begin",
      );
      final attempt = _activeAttempt;
      attempt?.disconnectRequestedAt = DateTime.now().toUtc();
      _logDisconnect(reason: reason, caller: caller, attempt: attempt);

      await _cleanupOwnedRoom(
        reason: reason,
        caller: caller,
        attempt: attempt,
      );

      _credentials = null;
      sessionId = "";
      recordingConfigured = false;
      evidenceOverlayRaw = null;
      _activeAttempt = null;

      if (!keepPreview) {
        await _disposeTracks(caller: caller);
        roomName = "";
        _previewActive = false;
        _transitionLifecycle(
          LiveVideoLifecyclePhase.idle,
          caller: "$caller:idle",
        );
      } else {
        await _disposeAudioTrack(caller: "$caller:keep_preview");
        await _recreateLocalVideoTrack(
          correlationId:
              correlationId.isNotEmpty ? correlationId : "live-video-preview",
          sessionId: "preview-after-stop",
          caller: "$caller:keep_preview",
        );
        _previewActive = true;
        _transitionLifecycle(
          LiveVideoLifecyclePhase.stopped,
          caller: "$caller:previewing",
        );
      }

      _logDisconnect(
        reason: reason,
        caller: caller,
        attempt: attempt,
        checkpoint: LiveVideoJoinCheckpoint.disconnectCompleted,
      );
    });
    _lastStopFuture = future;
    return future;
  }

  Future<void> stop({bool keepPreview = false}) => stopSession(
        keepPreview: keepPreview,
        reason: LiveVideoDisconnectReason.userStop,
        caller: "stop",
      );

  Future<void> toggleMute() async {
    _muted = !_muted;
    await _room?.localParticipant?.setMicrophoneEnabled(!_muted);
    notifyListeners();
  }

  Future<void> toggleCamera() async {
    _cameraEnabled = !_cameraEnabled;
    await _room?.localParticipant?.setCameraEnabled(_cameraEnabled);
    notifyListeners();
  }

  Future<void> switchCamera() async {
    final track = _localVideoTrack;
    if (track == null) return;
    final options = track.currentOptions;
    if (options is! CameraCaptureOptions) return;
    await track.setCameraPosition(options.cameraPosition.switched());
    notifyListeners();
  }

  Future<bool> safeReconnect() async {
    final credentials = _credentials;
    final room = _room;
    final attempt = _activeAttempt;
    if (credentials == null ||
        room == null ||
        attempt == null ||
        _reconnectInFlight ||
        _lifecycle.phase != LiveVideoLifecyclePhase.disconnectedUnexpectedly) {
      return false;
    }

    return _operationLock.run(() async {
      _reconnectInFlight = true;
      _transitionLifecycle(
        LiveVideoLifecyclePhase.connecting,
        caller: "safeReconnect",
      );
      try {
        await _disconnectOwnedRoom(
          room: room,
          roomInstanceId: attempt.roomInstanceId,
          attempt: attempt,
          reason: LiveVideoDisconnectReason.safeReconnect,
          caller: "safeReconnect:pre_connect",
        );
        joinFlow.mark(LiveVideoJoinCheckpoint.roomConnectBegin);
        await room.connect(
          credentials.url,
          credentials.token,
          connectOptions: const ConnectOptions(autoSubscribe: false),
        );
        joinFlow.mark(LiveVideoJoinCheckpoint.roomConnectSuccess);
        attempt.connectedAt = DateTime.now().toUtc();
        _transitionLifecycle(
          LiveVideoLifecyclePhase.streaming,
          caller: "safeReconnect:success",
        );
        return true;
      } catch (error, stackTrace) {
        lastConnectExceptionType = error.runtimeType.toString();
        lastConnectExceptionMessage = error.toString();
        lastConnectStackTraceHead = liveVideoStackTraceHead(stackTrace);
        logLiveVideoDiagnostic(
          checkpoint: LiveVideoJoinCheckpoint.roomConnectException,
          correlationId: correlationId,
          sessionId: sessionId,
          connectionAttemptId: attempt.connectionAttemptId,
          exceptionType: lastConnectExceptionType,
          exceptionMessage: lastConnectExceptionMessage,
          stackTraceHead: lastConnectStackTraceHead,
          internalReason: "SAFE_RECONNECT_FAILED",
        );
        _transitionLifecycle(
          LiveVideoLifecyclePhase.connectFailed,
          message:
              "Reconnection failed ($lastConnectExceptionType: $lastConnectExceptionMessage). "
              "Stop and start the stream again.",
          caller: "safeReconnect:failed",
        );
        return false;
      } finally {
        _reconnectInFlight = false;
      }
    });
  }

  @override
  void dispose() {
    _disposing = true;
    unawaited(
      stopSession(
        reason: LiveVideoDisconnectReason.widgetDispose,
        caller: "LiveVideoSessionController.dispose",
      ),
    );
    super.dispose();
  }

  void _bindRoomEvents(Room room, LiveVideoConnectionAttempt attempt) {
    _roomListener?.dispose();
    _roomListener = room.createListener()
      ..on<RoomReconnectingEvent>((_) {
        if (_disposing || !_isAttemptActive(attempt)) return;
        connectionState = LiveVideoConnectionState.reconnecting;
        notifyListeners();
      })
      ..on<RoomReconnectedEvent>((_) {
        if (_disposing || !_isAttemptActive(attempt)) return;
        _transitionLifecycle(
          LiveVideoLifecyclePhase.streaming,
          caller: "RoomReconnectedEvent",
        );
      })
      ..on<RoomDisconnectedEvent>((event) {
        if (_disposing || !_isAttemptActive(attempt)) return;
        final sdkReason = LiveVideoDisconnectReason.fromLiveKitReason(
          event.reason,
          caller: "RoomDisconnectedEvent",
        );
        _logDisconnect(
          reason: sdkReason ?? LiveVideoDisconnectReason.sdkDisconnected,
          caller: "RoomDisconnectedEvent",
          attempt: attempt,
          room: room,
        );
        if (_lifecycle.phase == LiveVideoLifecyclePhase.streaming ||
            connectionState == LiveVideoConnectionState.reconnecting) {
          _transitionLifecycle(
            LiveVideoLifecyclePhase.disconnectedUnexpectedly,
            message: _isNetworkDisconnect(event.reason)
                ? "Live video disconnected. Use reconnect or stop the stream."
                : "Live video disconnected.",
            caller: "RoomDisconnectedEvent",
          );
        }
      });
  }

  bool _isNetworkDisconnect(DisconnectReason? reason) {
    if (reason == null) return false;
    return reason == DisconnectReason.signalingConnectionFailure ||
        reason == DisconnectReason.disconnected ||
        reason == DisconnectReason.reconnectAttemptsExceeded;
  }

  Future<void> _cleanupOwnedRoom({
    Room? room,
    int? roomInstanceId,
    LiveVideoConnectionAttempt? attempt,
    required LiveVideoDisconnectReason reason,
    required String caller,
  }) async {
    final ownedRoom = room ?? _room;
    if (ownedRoom == null) return;
    final ownedInstanceId = roomInstanceId ??
        attempt?.roomInstanceId ??
        identityHashCode(ownedRoom);

    final isCurrent = identical(ownedRoom, _room) &&
        _activeRoomInstanceId == ownedInstanceId &&
        (attempt == null ||
            _activeAttempt?.connectionAttemptId == attempt.connectionAttemptId);

    if (isCurrent) {
      _room = null;
      _activeRoomInstanceId = null;
      _roomListener?.dispose();
      _roomListener = null;
    } else {
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.staleAttemptIgnored,
        connectionAttemptId: attempt?.connectionAttemptId,
        roomInstanceId: ownedInstanceId.toString(),
        internalReason: "stale_room_cleanup",
        disconnectReason: reason.code,
        disconnectCaller: caller,
      );
    }

    await _disconnectOwnedRoom(
      room: ownedRoom,
      roomInstanceId: ownedInstanceId,
      attempt: attempt,
      reason: reason,
      caller: caller,
    );
  }

  Future<void> _disconnectOwnedRoom({
    required Room room,
    required int? roomInstanceId,
    LiveVideoConnectionAttempt? attempt,
    required LiveVideoDisconnectReason reason,
    required String caller,
  }) async {
    _logDisconnect(
      reason: reason,
      caller: caller,
      attempt: attempt,
      room: room,
    );
    try {
      await room.disconnect();
    } catch (_) {
      // Best effort cleanup.
    }
    attempt?.disposedAt = DateTime.now().toUtc();
  }

  Future<void> _disposeAudioTrack({required String caller}) async {
    final audio = _localAudioTrack;
    _localAudioTrack = null;
    if (audio == null) return;
    logLiveVideoDiagnostic(
      checkpoint: LiveVideoJoinCheckpoint.disconnectRequested,
      disconnectCaller: caller,
      disconnectReason: LiveVideoDisconnectReason.staleAttemptCleanup.code,
      microphoneState: "disposing",
    );
    try {
      await audio.stop();
      await audio.dispose();
    } catch (_) {}
  }

  Future<void> _ensureLocalAudioTrack({
    required LiveVideoConnectionAttempt attempt,
    required String correlationId,
    required String sessionId,
  }) async {
    await _disposeAudioTrack(caller: "_ensureLocalAudioTrack");
    logLiveVideoDiagnostic(
      checkpoint: LiveVideoJoinCheckpoint.localAudioCreateBegin,
      correlationId: correlationId,
      sessionId: sessionId,
      connectionAttemptId: attempt.connectionAttemptId,
      roomInstanceId: attempt.roomInstanceId?.toString(),
    );
    _localAudioTrack = await LocalAudioTrack.create();
    await _localAudioTrack!.start();
    logLiveVideoDiagnostic(
      checkpoint: LiveVideoJoinCheckpoint.localAudioCreateSuccess,
      correlationId: correlationId,
      sessionId: sessionId,
      connectionAttemptId: attempt.connectionAttemptId,
      roomInstanceId: attempt.roomInstanceId?.toString(),
      microphoneState: "live",
    );
  }

  Future<void> _preparePublisherTracks({
    required LiveVideoConnectionAttempt attempt,
    required String correlationId,
    required String sessionId,
  }) async {
    if (audioOnly) {
      await _disposeVideoTrack(caller: "_preparePublisherTracks:audio_only");
      return;
    }
    await _recreateLocalVideoTrack(
      correlationId: correlationId,
      sessionId: sessionId,
      caller: "_preparePublisherTracks",
      attempt: attempt,
    );
  }

  Future<void> _createPreviewVideoTrack({required String caller}) async {
    logLiveVideoDiagnostic(
      checkpoint: LiveVideoJoinCheckpoint.localVideoCreateBegin,
      disconnectCaller: caller,
      cameraState: "creating_preview",
    );
    _localVideoTrack = await LocalVideoTrack.createCameraTrack(
      const CameraCaptureOptions(
        cameraPosition: CameraPosition.back,
        params: VideoParametersPresets.h360_169,
      ),
    );
    await _localVideoTrack!.start();
    logLiveVideoDiagnostic(
      checkpoint: LiveVideoJoinCheckpoint.localVideoCreateSuccess,
      disconnectCaller: caller,
      cameraState: "preview_ready",
    );
  }

  Future<void> _recreateLocalVideoTrack({
    required String correlationId,
    required String sessionId,
    required String caller,
    LiveVideoConnectionAttempt? attempt,
  }) async {
    await _disposeVideoTrack(caller: caller);
    logLiveVideoDiagnostic(
      checkpoint: LiveVideoJoinCheckpoint.localVideoCreateBegin,
      correlationId: correlationId,
      sessionId: sessionId,
      connectionAttemptId: attempt?.connectionAttemptId,
      roomName: roomName,
      disconnectCaller: caller,
      cameraState: "creating_publish",
    );
    _localVideoTrack = await LocalVideoTrack.createCameraTrack(
      const CameraCaptureOptions(
        cameraPosition: CameraPosition.back,
        params: VideoParametersPresets.h360_169,
      ),
    );
    await _localVideoTrack!.start();
    logLiveVideoDiagnostic(
      checkpoint: LiveVideoJoinCheckpoint.localVideoCreateSuccess,
      correlationId: correlationId,
      sessionId: sessionId,
      connectionAttemptId: attempt?.connectionAttemptId,
      roomName: roomName,
      disconnectCaller: caller,
      cameraState: "publish_ready",
    );
  }

  Future<void> _disposeVideoTrack({required String caller}) async {
    final video = _localVideoTrack;
    _localVideoTrack = null;
    if (video == null) return;
    logLiveVideoDiagnostic(
      checkpoint: LiveVideoJoinCheckpoint.disconnectRequested,
      disconnectCaller: caller,
      disconnectReason: LiveVideoDisconnectReason.staleAttemptCleanup.code,
      cameraState: "disposing",
    );
    try {
      await video.stop();
      await video.dispose();
    } catch (_) {}
  }

  Future<void> _disposeTracks({required String caller}) async {
    await _disposeVideoTrack(caller: caller);
    await _disposeAudioTrack(caller: caller);
  }
}
