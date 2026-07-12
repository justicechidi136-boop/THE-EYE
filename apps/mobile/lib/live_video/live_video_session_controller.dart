import "dart:async";

import "package:flutter/foundation.dart";
import "package:livekit_client/livekit_client.dart";

import "../evidence/evidence_permission_service.dart";
import "../evidence/evidence_permission_state.dart";
import "live_video_api_models.dart";
import "live_video_connection_state.dart";
import "live_video_safe_log.dart";

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
  Room? _room;
  LocalVideoTrack? _localVideoTrack;
  LocalAudioTrack? _localAudioTrack;
  EventsListener<RoomEvent>? _roomListener;
  LiveKitCredentials? _credentials;
  bool _lowBandwidth = true;
  bool _muted = false;
  bool _cameraEnabled = true;
  bool _disposing = false;
  bool _reconnectInFlight = false;

  LiveVideoConnectionState connectionState = LiveVideoConnectionState.idle;
  String? errorMessage;
  String roomName = "";
  String sessionId = "";
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
    if (camera == EvidencePermissionState.permanentlyDenied ||
        microphone == EvidencePermissionState.permanentlyDenied) {
      return const LiveVideoPermissionOutcome(
        granted: false,
        message:
            "Enable camera and microphone in device settings to start live emergency video.",
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
      _localVideoTrack = await LocalVideoTrack.createCameraTrack(
        CameraCaptureOptions(
          cameraPosition: CameraPosition.back,
          params: VideoParametersPresets.h360_169,
        ),
      );
      await _localVideoTrack!.start();
      _setState(LiveVideoConnectionState.previewing);
      return true;
    } catch (error) {
      logLiveVideoEvent("Live video preview failed");
      _setState(LiveVideoConnectionState.failed,
          message: "Unable to start camera preview.");
      return false;
    }
  }

  Future<bool> connectPublisher(LiveVideoStartResult startResult) async {
    if (!startResult.livekit.isValid) {
      _setState(LiveVideoConnectionState.failed,
          message: "Live video access token was not returned by the server.");
      return false;
    }

    _credentials = startResult.livekit;
    roomName = startResult.roomName;
    sessionId = startResult.sessionId;
    recordingConfigured = startResult.recordingConfigured;
    evidenceOverlayRaw = startResult.evidenceOverlay;
    _setState(LiveVideoConnectionState.connecting);

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
      _bindRoomEvents(_room!);
      await _room!
          .connect(
            _credentials!.url,
            _credentials!.token,
            connectOptions: const ConnectOptions(autoSubscribe: false),
          )
          .timeout(
            connectTimeout,
            onTimeout: () => throw TimeoutException(
              "LiveKit connect timed out after ${connectTimeout.inSeconds}s",
            ),
          );

      _localAudioTrack ??= await LocalAudioTrack.create();
      await _localAudioTrack!.start();

      final participant = _room!.localParticipant;
      if (participant == null) throw Exception("Local participant unavailable");

      if (_localVideoTrack != null) {
        await participant.publishVideoTrack(_localVideoTrack!);
      }
      await participant.publishAudioTrack(_localAudioTrack!);
      await participant.setMicrophoneEnabled(!_muted);
      await participant.setCameraEnabled(_cameraEnabled);

      _setState(LiveVideoConnectionState.connected);
      logLiveVideoEvent("Live video publisher connected to room $roomName");
      return true;
    } catch (error) {
      logLiveVideoEvent("Live video publisher connection failed");
      _setState(
        LiveVideoConnectionState.failed,
        message: error is TimeoutException
            ? "Live video connection timed out. Check network and try again."
            : "Unable to join the live video room. Try again.",
      );
      return false;
    }
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
      await room.connect(credentials.url, credentials.token,
          connectOptions: const ConnectOptions(autoSubscribe: false));
      _setState(LiveVideoConnectionState.connected);
      return true;
    } catch (_) {
      _setState(LiveVideoConnectionState.failed,
          message: "Reconnection failed. Stop and start the stream again.");
      return false;
    } finally {
      _reconnectInFlight = false;
    }
  }

  Future<void> stop({bool keepPreview = false}) async {
    final room = _room;
    _room = null;
    _credentials = null;
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

  /// livekit_client 2.5.4 exposes network-related disconnect reasons as
  /// [DisconnectReason.signalingConnectionFailure], [DisconnectReason.disconnected],
  /// and [DisconnectReason.reconnectAttemptsExceeded] — not `networkError`.
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
