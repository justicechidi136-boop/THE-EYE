import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:livekit_client/livekit_client.dart';

import '../../services/field_app_services.dart';
import '../../theme/field_theme.dart';

class FieldBroadcastLiveVideoScreen extends StatefulWidget {
  const FieldBroadcastLiveVideoScreen({
    super.key,
    required this.services,
    required this.broadcastId,
    required this.broadcastTitle,
  });

  final FieldAppServices services;
  final String broadcastId;
  final String broadcastTitle;

  @override
  State<FieldBroadcastLiveVideoScreen> createState() =>
      _FieldBroadcastLiveVideoScreenState();
}

class _FieldBroadcastLiveVideoScreenState
    extends State<FieldBroadcastLiveVideoScreen> {
  Room? _room;
  VideoTrack? _videoTrack;
  String? _sessionId;
  String? _error;
  bool _connecting = true;
  bool _cameraEnabled = true;
  bool _microphoneEnabled = true;
  bool _stopping = false;

  @override
  void initState() {
    super.initState();
    unawaited(_start());
  }

  Future<void> _start() async {
    setState(() {
      _connecting = true;
      _error = null;
    });
    Room? room;
    try {
      await widget.services.restoreSession();
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
      final response = await widget.services.workflows
          .startBroadcastLiveVideo(widget.broadcastId, {
            'latitude': position.latitude,
            'longitude': position.longitude,
            'accuracy': position.accuracy,
            'capturedAt': position.timestamp.toUtc().toIso8601String(),
            'lowBandwidthMode': false,
          });
      final connection = Map<String, dynamic>.from(
        (response['connection'] as Map?) ?? const {},
      );
      final serverUrl = connection['serverUrl']?.toString() ?? '';
      final token = connection['participantToken']?.toString() ?? '';
      if (serverUrl.isEmpty || token.isEmpty) {
        throw StateError('Live video connection details are unavailable.');
      }

      room = Room(
        roomOptions: const RoomOptions(adaptiveStream: true, dynacast: true),
      );
      await room.connect(serverUrl, token);
      final participant = room.localParticipant;
      if (participant == null) {
        throw StateError('Live video publisher is unavailable.');
      }
      await participant.setCameraEnabled(true);
      await participant.setMicrophoneEnabled(true);
      VideoTrack? track;
      for (final publication in participant.videoTrackPublications) {
        if (publication.track is VideoTrack) {
          track = publication.track as VideoTrack;
          break;
        }
      }
      if (!mounted) {
        await room.disconnect();
        return;
      }
      setState(() {
        _room = room;
        _videoTrack = track;
        _sessionId = (response['data'] as Map?)?['id']?.toString();
        _connecting = false;
      });
    } catch (error) {
      await room?.disconnect();
      if (!mounted) return;
      setState(() {
        _connecting = false;
        _error = error.toString().replaceFirst('Bad state: ', '');
      });
    }
  }

  Future<void> _toggleCamera() async {
    final participant = _room?.localParticipant;
    if (participant == null) return;
    final enabled = !_cameraEnabled;
    await participant.setCameraEnabled(enabled);
    if (mounted) setState(() => _cameraEnabled = enabled);
  }

  Future<void> _toggleMicrophone() async {
    final participant = _room?.localParticipant;
    if (participant == null) return;
    final enabled = !_microphoneEnabled;
    await participant.setMicrophoneEnabled(enabled);
    if (mounted) setState(() => _microphoneEnabled = enabled);
  }

  Future<void> _stop() async {
    if (_stopping) return;
    setState(() => _stopping = true);
    try {
      if (_sessionId != null) {
        await widget.services.workflows.stopLiveVideo(_sessionId!);
      }
      await _room?.disconnect();
      if (mounted) Navigator.of(context).pop();
    } finally {
      if (mounted) setState(() => _stopping = false);
    }
  }

  @override
  void dispose() {
    unawaited(_room?.disconnect());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _room == null,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(_stop());
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Broadcast live video')),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                widget.broadcastTitle,
                style: Theme.of(context).textTheme.titleLarge,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 16),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: ColoredBox(
                    color: Colors.black,
                    child:
                        _connecting
                            ? const Center(child: CircularProgressIndicator())
                            : _error != null
                            ? _LiveVideoError(message: _error!, onRetry: _start)
                            : _videoTrack != null && _cameraEnabled
                            ? VideoTrackRenderer(
                              _videoTrack!,
                              fit: VideoViewFit.cover,
                            )
                            : const Center(
                              child: Icon(
                                Icons.videocam_off_outlined,
                                color: Colors.white,
                                size: 72,
                              ),
                            ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton.filledTonal(
                    tooltip:
                        _microphoneEnabled
                            ? 'Mute microphone'
                            : 'Unmute microphone',
                    onPressed: _room == null ? null : _toggleMicrophone,
                    icon: Icon(_microphoneEnabled ? Icons.mic : Icons.mic_off),
                  ),
                  const SizedBox(width: 16),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: FieldColors.danger,
                    ),
                    onPressed: _room == null || _stopping ? null : _stop,
                    icon: const Icon(Icons.stop_circle_outlined),
                    label: Text(_stopping ? 'Stopping...' : 'Stop live video'),
                  ),
                  const SizedBox(width: 16),
                  IconButton.filledTonal(
                    tooltip:
                        _cameraEnabled ? 'Turn camera off' : 'Turn camera on',
                    onPressed: _room == null ? null : _toggleCamera,
                    icon: Icon(
                      _cameraEnabled ? Icons.videocam : Icons.videocam_off,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LiveVideoError extends StatelessWidget {
  const _LiveVideoError({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_outlined, color: Colors.white, size: 52),
          const SizedBox(height: 12),
          Text(message, style: const TextStyle(color: Colors.white)),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
