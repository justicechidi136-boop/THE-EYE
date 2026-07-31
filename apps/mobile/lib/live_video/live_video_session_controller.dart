import "dart:async";

import "package:flutter/foundation.dart";
import "package:livekit_client/livekit_client.dart";

import "../evidence/evidence_permission_service.dart";
import "../evidence/evidence_permission_state.dart";
import "live_video_api_models.dart";
import "live_video_connection_state.dart";
import "live_video_error_codes.dart";
import "live_video_join_flow.dart";
import "live_video_safe_log.dart";
import "live_video_start_validation.dart";

class LiveVideoPermissionOutcome {
  const LiveVideoPermissionOutcome({required this.granted, this.message});

  final bool granted;
  final String? message;
}

class LiveVideoSessionController extends ChangeNotifier {
  LiveVideoSessionController({EvidencePermissionService? permissionService})
      : _permissionService = permissionService ?? EvidencePermissionService();

  static const connectTimeout = Duration(seconds: 30);

  final EvidencePermissionService _permissionService;
  final LiveVideoJoinFlowTracker joinFlow = LiveVideoJoinFlowTracker();
  Room? _room;
  LocalVideoTrack? _localVideoTrack;
  LocalAudioTrack? _localAudioTrack;
  EventsListener<RoomEvent>? _roomListener;
  LiveKitCredentials? _credentials;
  String _participantIdentity = "";
  int? _activeRoomInstanceId;
  bool _lowBandwidth = true;
  bool _muted = false;
  bool _cameraEnabled = true;
  bool _disposing = false;
  bool _reconnectInFlight = false;

  LiveVideoConnectionState connectionState = LiveVideoConnectionState.idle;
  String? errorMessage;
  String roomName = "";
  String sessionId = "";
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
  bool get isStreaming =>
      connectionState == LiveVideoConnectionState.connected ||
      connectionState == LiveVideoConnectionState.reconnecting;

  Future<LiveVideoPermissionOutcome> ensurePermissions() async {
    var camera = await _permissionService.cameraState();
    if (camera == EvidencePermissionState.notRequested ||
        camera == EvidencePermissionState.denied) {
      camera = await _permissionService.requestCamera();
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
        message:
            "Camera permission is required for live emergency video. "
            "Reference: ${LiveVideoErrorCodes.cameraPermissionDenied}.",
      );
    }
    if (camera == EvidencePermissionState.granted &&
        microphone != EvidencePermissionState.granted) {
      return LiveVideoPermissionOutcome(
        granted: false,
        message:
            "Microphone permission is required for live emergency video. "
            "Reference: ${LiveVideoErrorCodes.microphonePermissionDenied}.",
      );
    }
    if (camera == EvidencePermissionState.permanentlyDenied ||
        microphone == EvidencePermissionState.permanentlyDenied) {
      return LiveVideoPermissionOutcome(
        granted: false,
        message:
            "Enable camera and microphone in device settings to start live emergency video. "
            "Reference: ${LiveVideoErrorCodes.cameraPermissionDenied}.",
      );
    }
    if (camera == EvidencePermissionState.restricted ||
        microphone == EvidencePermissionState.restricted) {
      return const LiveVideoPermissionOutcome(
        granted: false,
        message: "Camera or microphone access is restricted on this device.",
      );
    }
    return const LiveVideoPermissionOutcome(
      granted: false,
      message:
          "Camera and microphone permission are required for live emergency video.",
    );
  }

  Future<bool> startLocalPreview({bool lowBandwidth = true}) async {
    _lowBandwidth = lowBandwidth;
    final permissions = await ensurePermissions();
    if (!permissions.granted) {
      _setState(LiveVideoConnectionState.failed, message: permissions.message);
      return false;
    }

    try {
      await _disposeTracks();
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.localVideoCreateBegin,
        correlationId: correlationId,
        sessionId: sessionId,
        roomName: roomName,
      );
      _localVideoTrack = await LocalVideoTrack.createCameraTrack(
        CameraCaptureOptions(
          cameraPosition: CameraPosition.back,
          params: VideoParametersPresets.h360_169,
        ),
      );
      await _localVideoTrack!.start();
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.localVideoCreateSuccess,
        correlationId: correlationId,
        sessionId: sessionId,
        roomName: roomName,
      );
      _setState(LiveVideoConnectionState.previewing);
      return true;
    } catch (error, stackTrace) {
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.localVideoCreateBegin,
        correlationId: correlationId,
        sessionId: sessionId,
        exceptionType: error.runtimeType.toString(),
        exceptionMessage: error.toString(),
        stackTraceHead: liveVideoStackTraceHead(stackTrace),
        internalReason: "LOCAL_VIDEO_CREATE_FAILED",
      );
      _setState(LiveVideoConnectionState.failed,
          message: "Unable to start camera preview ($error).");
      return false;
    }
  }

  Future<bool> connectPublisher(LiveVideoStartResult startResult) async {
    joinFlow.reset();
    joinFlow.mark(LiveVideoJoinCheckpoint.connectPublisherInvoked);

    correlationId = startResult.correlationId;
    lastConnectFailureReason = null;
    lastConnectExceptionType = null;
    lastConnectExceptionMessage = null;
    lastConnectStackTraceHead = null;

    _credentials = startResult.livekit;
    _participantIdentity = startResult.participantIdentity;
    roomName = startResult.roomName;
    sessionId = startResult.sessionId;
    recordingConfigured = startResult.recordingConfigured;
    evidenceOverlayRaw = startResult.evidenceOverlay;
    _setState(LiveVideoConnectionState.connecting);

    final runtimeUrl = _credentials!.url.trim();
    final runtimeToken = _credentials!.token.trim();
    final runtimeRoomName = roomName.trim();
    final runtimeIdentity = _participantIdentity.trim();
    final uri = liveVideoUrlHost(runtimeUrl);
    final tokenFingerprint = liveVideoTokenFingerprint(runtimeToken);

    logLiveVideoDiagnostic(
      checkpoint: LiveVideoJoinCheckpoint.sessionParsed,
      correlationId: correlationId,
      sessionId: sessionId,
      roomName: runtimeRoomName,
      participantIdentity: runtimeIdentity,
      urlScheme: uri?.scheme,
      urlHost: uri?.host,
      serverUrlLength: runtimeUrl.length.toString(),
      tokenLength: runtimeToken.length.toString(),
      tokenFingerprint: tokenFingerprint,
      connectionState: connectionState.name,
    );

    if (runtimeUrl.isEmpty || runtimeToken.isEmpty || runtimeRoomName.isEmpty) {
      joinFlow.recordInterrupt(
        reason: "empty_runtime_connect_inputs",
        location: "connectPublisher:preconnect_validation",
      );
      _failBeforeConnect(
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
      _failBeforeConnect("Live video controller is disposing before Room.connect.");
      return false;
    }

    try {
      _room = Room(
        roomOptions: RoomOptions(
          adaptiveStream: true,
          dynacast: true,
          defaultAudioPublishOptions: AudioPublishOptions(
            dtx: _lowBandwidth,
          ),
          defaultVideoPublishOptions: VideoPublishOptions(
            simulcast: !_lowBandwidth,
            videoEncoding: VideoEncoding(
              maxBitrate: _lowBandwidth ? 120000 : 800000,
              maxFramerate: _lowBandwidth ? 15 : 30,
            ),
          ),
        ),
      );
      _activeRoomInstanceId = identityHashCode(_room);
      _bindRoomEvents(_room!);
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.roomCreated,
        correlationId: correlationId,
        sessionId: sessionId,
        roomName: runtimeRoomName,
        participantIdentity: runtimeIdentity,
        roomInstanceId: _activeRoomInstanceId.toString(),
      );

      joinFlow.mark(LiveVideoJoinCheckpoint.roomConnectBegin);
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.roomConnectBegin,
        correlationId: correlationId,
        sessionId: sessionId,
        roomName: runtimeRoomName,
        participantIdentity: runtimeIdentity,
        urlScheme: uri?.scheme,
        urlHost: uri?.host,
        serverUrlLength: runtimeUrl.length.toString(),
        tokenLength: runtimeToken.length.toString(),
        tokenFingerprint: tokenFingerprint,
        roomInstanceId: _activeRoomInstanceId.toString(),
      );

      await _room!
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

      joinFlow.mark(LiveVideoJoinCheckpoint.roomConnectSuccess);
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.roomConnectSuccess,
        correlationId: correlationId,
        sessionId: sessionId,
        roomName: runtimeRoomName,
        participantIdentity: runtimeIdentity,
        roomInstanceId: _activeRoomInstanceId.toString(),
        connectionState: _room!.connectionState.name,
      );
    } catch (error, stackTrace) {
      joinFlow.mark(LiveVideoJoinCheckpoint.roomConnectException);
      lastConnectFailureReason = "ROOM_CONNECT_FAILED";
      lastConnectExceptionType = error.runtimeType.toString();
      lastConnectExceptionMessage = error.toString();
      lastConnectStackTraceHead = liveVideoStackTraceHead(stackTrace);
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.roomConnectException,
        correlationId: correlationId,
        sessionId: sessionId,
        roomName: runtimeRoomName,
        participantIdentity: runtimeIdentity,
        urlScheme: uri?.scheme,
        urlHost: uri?.host,
        serverUrlLength: runtimeUrl.length.toString(),
        tokenLength: runtimeToken.length.toString(),
        tokenFingerprint: tokenFingerprint,
        roomInstanceId: _activeRoomInstanceId?.toString(),
        exceptionType: lastConnectExceptionType,
        exceptionMessage: lastConnectExceptionMessage,
        stackTraceHead: lastConnectStackTraceHead,
        internalReason: lastConnectFailureReason,
      );
      if (kDebugMode) {
        debugPrintStack(stackTrace: stackTrace, label: "live_video_room_connect");
      }
      final code = LiveVideoErrorCodes.connectLivekitFailed;
      _setState(
        LiveVideoConnectionState.failed,
        message: error is TimeoutException
            ? "Live video connection timed out. Check network and try again. "
                "($lastConnectExceptionType: $lastConnectExceptionMessage) "
                "Reference: $code."
            : "Unable to join the live video room "
                "($lastConnectExceptionType: $lastConnectExceptionMessage). "
                "Reference: $code.",
      );
      return false;
    }

    try {
      if (_localAudioTrack == null) {
        logLiveVideoDiagnostic(
          checkpoint: LiveVideoJoinCheckpoint.localAudioCreateBegin,
          correlationId: correlationId,
          sessionId: sessionId,
          roomInstanceId: _activeRoomInstanceId.toString(),
        );
        _localAudioTrack = await LocalAudioTrack.create();
        await _localAudioTrack!.start();
        logLiveVideoDiagnostic(
          checkpoint: LiveVideoJoinCheckpoint.localAudioCreateSuccess,
          correlationId: correlationId,
          sessionId: sessionId,
          roomInstanceId: _activeRoomInstanceId.toString(),
        );
      }

      final participant = _room!.localParticipant;
      if (participant == null) {
        throw StateError("Local participant unavailable after room connect");
      }

      if (_localVideoTrack != null) {
        await participant.publishVideoTrack(_localVideoTrack!);
      }
      await participant.publishAudioTrack(_localAudioTrack!);
      await participant.setMicrophoneEnabled(!_muted);
      await participant.setCameraEnabled(_cameraEnabled);

      _setState(LiveVideoConnectionState.connected);
      joinFlow.mark(LiveVideoJoinCheckpoint.tracksPublished);
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.tracksPublished,
        correlationId: correlationId,
        sessionId: sessionId,
        roomName: runtimeRoomName,
        roomInstanceId: _activeRoomInstanceId.toString(),
        connectionState: connectionState.name,
      );
      return true;
    } catch (error, stackTrace) {
      lastConnectFailureReason = "TRACK_PUBLISH_FAILED";
      lastConnectExceptionType = error.runtimeType.toString();
      lastConnectExceptionMessage = error.toString();
      lastConnectStackTraceHead = liveVideoStackTraceHead(stackTrace);
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.tracksPublished,
        correlationId: correlationId,
        sessionId: sessionId,
        roomName: runtimeRoomName,
        roomInstanceId: _activeRoomInstanceId?.toString(),
        exceptionType: lastConnectExceptionType,
        exceptionMessage: lastConnectExceptionMessage,
        stackTraceHead: lastConnectStackTraceHead,
        internalReason: lastConnectFailureReason,
      );
      if (kDebugMode) {
        debugPrintStack(stackTrace: stackTrace, label: "live_video_track_publish");
      }
      final code = LiveVideoErrorCodes.publishTracksFailed;
      _setState(
        LiveVideoConnectionState.failed,
        message:
            "Connected to live video but could not publish camera/microphone "
            "($lastConnectExceptionType: $lastConnectExceptionMessage). "
            "Reference: $code.",
      );
      return false;
    }
  }

  void _failBeforeConnect(String message) {
    lastConnectFailureReason =
        LiveVideoErrorCodes.joinFlowInterruptedBeforeConnect;
    lastConnectExceptionType = "JoinFlowInterrupted";
    lastConnectExceptionMessage = message;
    _setState(
      LiveVideoConnectionState.failed,
      message:
          "$message Reference: ${LiveVideoErrorCodes.joinFlowInterruptedBeforeConnect}.",
    );
  }

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
    if (credentials == null || room == null || _reconnectInFlight) return false;
    _reconnectInFlight = true;
    _setState(LiveVideoConnectionState.reconnecting);
    try {
      await room.disconnect();
      joinFlow.mark(LiveVideoJoinCheckpoint.roomConnectBegin);
      await room.connect(credentials.url, credentials.token,
          connectOptions: const ConnectOptions(autoSubscribe: false));
      joinFlow.mark(LiveVideoJoinCheckpoint.roomConnectSuccess);
      _setState(LiveVideoConnectionState.connected);
      return true;
    } catch (error, stackTrace) {
      lastConnectExceptionType = error.runtimeType.toString();
      lastConnectExceptionMessage = error.toString();
      lastConnectStackTraceHead = liveVideoStackTraceHead(stackTrace);
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.roomConnectException,
        correlationId: correlationId,
        sessionId: sessionId,
        exceptionType: lastConnectExceptionType,
        exceptionMessage: lastConnectExceptionMessage,
        stackTraceHead: lastConnectStackTraceHead,
        internalReason: "SAFE_RECONNECT_FAILED",
      );
      _setState(
        LiveVideoConnectionState.failed,
        message:
            "Reconnection failed ($lastConnectExceptionType: $lastConnectExceptionMessage). "
            "Stop and start the stream again.",
      );
      return false;
    } finally {
      _reconnectInFlight = false;
    }
  }

  Future<void> stop({bool keepPreview = false}) async {
    final room = _room;
    _room = null;
    _credentials = null;
    _activeRoomInstanceId = null;
    sessionId = "";
    recordingConfigured = false;
    evidenceOverlayRaw = null;
    _roomListener?.dispose();
    _roomListener = null;
    if (room != null) {
      try {
        await room.disconnect();
      } catch (_) {
        // Best effort cleanup.
      }
    }
    if (!keepPreview) {
      await _disposeTracks();
      roomName = "";
      _setState(LiveVideoConnectionState.idle);
    } else {
      _setState(LiveVideoConnectionState.previewing);
    }
  }

  @override
  void dispose() {
    _disposing = true;
    unawaited(stop());
    super.dispose();
  }

  void _bindRoomEvents(Room room) {
    _roomListener?.dispose();
    _roomListener = room.createListener()
      ..on<RoomReconnectingEvent>((_) {
        if (_disposing) return;
        _setState(LiveVideoConnectionState.reconnecting);
      })
      ..on<RoomReconnectedEvent>((_) {
        if (_disposing) return;
        _setState(LiveVideoConnectionState.connected);
      })
      ..on<RoomDisconnectedEvent>((event) {
        if (_disposing) return;
        if (connectionState == LiveVideoConnectionState.connected ||
            connectionState == LiveVideoConnectionState.reconnecting) {
          _setState(
            LiveVideoConnectionState.disconnected,
            message: _isNetworkDisconnect(event.reason)
                ? "Live video disconnected. Use reconnect or stop the stream."
                : "Live video disconnected.",
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

  Future<void> _disposeTracks() async {
    final video = _localVideoTrack;
    final audio = _localAudioTrack;
    _localVideoTrack = null;
    _localAudioTrack = null;
    if (video != null) {
      await video.stop();
      await video.dispose();
    }
    if (audio != null) {
      await audio.stop();
      await audio.dispose();
    }
  }

  void _setState(LiveVideoConnectionState next, {String? message}) {
    connectionState = next;
    errorMessage = message;
    notifyListeners();
  }
}
