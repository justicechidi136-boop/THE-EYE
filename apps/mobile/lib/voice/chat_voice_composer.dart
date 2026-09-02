import "dart:async";
import "dart:io";

import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:just_audio/just_audio.dart";
import "package:path/path.dart" as p;
import "package:path_provider/path_provider.dart";
import "package:permission_handler/permission_handler.dart";
import "package:record/record.dart";
import "package:uuid/uuid.dart";

import "../contracts/the_eye_enums.dart";
import "../design_system/eye_semantic_colors.dart";
import "../evidence/evidence_hash.dart";
import "../evidence/local_evidence_attachment.dart";
import "voice_constants.dart";
import "voice_report_validation.dart";

typedef ChatVoiceSendCallback = Future<void> Function(
  VoiceRecordingResult recording,
);

class ChatVoiceComposer extends StatefulWidget {
  const ChatVoiceComposer({
    required this.onSend,
    required this.onCancel,
    this.sending = false,
    this.autoStart = true,
    super.key,
  });

  final ChatVoiceSendCallback onSend;
  final VoidCallback onCancel;
  final bool sending;
  final bool autoStart;

  @override
  State<ChatVoiceComposer> createState() => _ChatVoiceComposerState();
}

class _ChatVoiceComposerState extends State<ChatVoiceComposer> {
  final AudioRecorder _recorder = AudioRecorder();
  Timer? _timer;
  String? _filePath;
  int _elapsedSeconds = 0;
  bool _recording = false;
  bool _paused = false;
  bool _finalizing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.autoStart) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) unawaited(_start());
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    unawaited(_recorder.dispose());
    super.dispose();
  }

  Future<void> _start() async {
    if (_recording || _finalizing || widget.sending) return;
    final permission = await Permission.microphone.request();
    if (!permission.isGranted) {
      if (mounted) {
        setState(() => _error = "Microphone permission is required.");
      }
      return;
    }

    final previousPath = _filePath;
    if (previousPath != null) {
      final previousFile = File(previousPath);
      if (previousFile.existsSync()) await previousFile.delete();
    }
    final directory = await getTemporaryDirectory();
    final path = p.join(directory.path, "chat-voice-${const Uuid().v4()}.m4a");
    try {
      await _recorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 64000,
          sampleRate: 44100,
          numChannels: 1,
        ),
        path: path,
      );
    } catch (_) {
      if (mounted) setState(() => _error = "Recording could not start.");
      return;
    }
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _paused) return;
      setState(() => _elapsedSeconds += 1);
      if (_elapsedSeconds >= voiceMaxDurationSeconds) {
        unawaited(_finishAndSend());
      }
    });
    if (!mounted) return;
    setState(() {
      _filePath = path;
      _elapsedSeconds = 0;
      _recording = true;
      _paused = false;
      _error = null;
    });
    HapticFeedback.mediumImpact();
  }

  Future<void> _togglePause() async {
    if (!_recording || _finalizing || widget.sending) return;
    if (_paused) {
      await _recorder.resume();
    } else {
      await _recorder.pause();
    }
    if (!mounted) return;
    setState(() => _paused = !_paused);
  }

  Future<void> _cancel() async {
    if (_finalizing || widget.sending) return;
    _timer?.cancel();
    if (_recording) await _recorder.stop();
    final path = _filePath;
    if (path != null) {
      final file = File(path);
      if (file.existsSync()) await file.delete();
    }
    if (mounted) widget.onCancel();
  }

  Future<void> _finishAndSend() async {
    if (!_recording || _finalizing || widget.sending) return;
    setState(() {
      _finalizing = true;
      _error = null;
    });
    _timer?.cancel();
    try {
      final stoppedPath = await _recorder.stop();
      final path = stoppedPath ?? _filePath;
      if (path == null || !File(path).existsSync()) {
        throw const FileSystemException("Voice recording was not created.");
      }
      final file = File(path);
      final sizeBytes = await file.length();
      if (sizeBytes <= 0 || sizeBytes > voiceMaxFileBytes) {
        throw const FileSystemException(
            "Voice recording is empty or too large.");
      }
      final duration = _elapsedSeconds <= 0 ? 1 : _elapsedSeconds;
      final hash = await sha256FileHash(path);
      final attachment = LocalEvidenceAttachment(
        localId: const Uuid().v4(),
        mediaType: IncidentMediaType.audio,
        fileName: p.basename(path),
        originalPath: path,
        uploadPath: path,
        contentType: "audio/mp4",
        fileHash: hash,
        originalFileHash: hash,
        sizeBytes: sizeBytes,
        capturedAt: DateTime.now().toUtc(),
        durationSeconds: duration,
        metadata: const {
          "selectedLanguage": "auto",
          "voiceComment": true,
        },
      );
      if (mounted) {
        setState(() {
          _recording = false;
          _paused = false;
        });
      }
      await widget.onSend(
        VoiceRecordingResult(
          attachment: attachment,
          durationSeconds: duration,
          selectedLanguage: "auto",
        ),
      );
    } catch (_) {
      if (mounted) {
        setState(() => _error = "Voice message could not be sent. Try again.");
      }
    } finally {
      if (mounted) setState(() => _finalizing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final busy = _finalizing || widget.sending;
    return Semantics(
      container: true,
      label: _paused ? "Voice message paused" : "Recording voice message",
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            key: const Key("chat-voice-composer"),
            constraints: const BoxConstraints(minHeight: 64),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
            decoration: BoxDecoration(
              color: colors.elevatedSurface,
              borderRadius: BorderRadius.circular(32),
              border: Border.all(color: colors.border),
            ),
            child: Row(
              children: [
                IconButton(
                  tooltip: "Cancel voice message",
                  onPressed: busy ? null : _cancel,
                  color: colors.error,
                  icon: const Icon(Icons.delete_outline_rounded),
                ),
                const SizedBox(width: 2),
                Container(
                  width: 9,
                  height: 9,
                  decoration: BoxDecoration(
                    color: _paused ? colors.border : colors.error,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  formatVoiceDuration(_elapsedSeconds),
                  key: const Key("chat-voice-duration"),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _ChatVoiceWaveform(
                    active: _recording && !_paused && !busy,
                  ),
                ),
                IconButton(
                  tooltip: _paused ? "Resume recording" : "Pause recording",
                  onPressed: !_recording || busy ? null : _togglePause,
                  icon: Icon(
                    _paused ? Icons.mic_rounded : Icons.pause_rounded,
                  ),
                ),
                const SizedBox(width: 2),
                IconButton.filled(
                  key: const Key("send-chat-voice-message"),
                  tooltip: "Send voice message",
                  onPressed: !_recording || busy ? null : _finishAndSend,
                  style: IconButton.styleFrom(
                    backgroundColor: colors.primaryAction,
                    foregroundColor: Colors.white,
                    minimumSize: const Size.square(46),
                  ),
                  icon: busy
                      ? const SizedBox.square(
                          dimension: 19,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.send_rounded),
                ),
              ],
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: Text(
                    _error!,
                    style: TextStyle(color: colors.error),
                  ),
                ),
                TextButton(
                  onPressed: busy ? null : _start,
                  child: const Text("Retry"),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _ChatVoiceWaveform extends StatelessWidget {
  const _ChatVoiceWaveform({required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return ExcludeSemantics(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: List.generate(15, (index) {
          final height = 8.0 + ((index * 7) % 18);
          return AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            width: 3,
            height: active ? height : 5,
            decoration: BoxDecoration(
              color: active ? colors.primaryAction : colors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          );
        }),
      ),
    );
  }
}

class ChatVoiceNotePlayer extends StatefulWidget {
  const ChatVoiceNotePlayer({
    required this.url,
    this.durationSeconds,
    this.semanticLabel = "Voice note",
    this.bubbleKey = const Key("chat-voice-message-bubble"),
    super.key,
  });

  final String url;
  final int? durationSeconds;
  final String semanticLabel;
  final Key bubbleKey;

  @override
  State<ChatVoiceNotePlayer> createState() => _ChatVoiceNotePlayerState();
}

class _ChatVoiceNotePlayerState extends State<ChatVoiceNotePlayer> {
  final AudioPlayer _player = AudioPlayer();
  StreamSubscription<PlayerState>? _stateSubscription;
  StreamSubscription<Duration>? _positionSubscription;
  bool _loading = false;
  bool _playing = false;
  bool _failed = false;
  String? _loadedUrl;
  Duration _position = Duration.zero;

  @override
  void initState() {
    super.initState();
    _stateSubscription = _player.playerStateStream.listen((state) {
      if (!mounted) return;
      setState(() {
        _playing = state.playing;
        if (state.processingState == ProcessingState.completed) {
          _playing = false;
        }
      });
    });
    _positionSubscription = _player.positionStream.listen((position) {
      if (mounted) setState(() => _position = position);
    });
  }

  @override
  void didUpdateWidget(covariant ChatVoiceNotePlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) {
      _loadedUrl = null;
      _position = Duration.zero;
    }
  }

  @override
  void dispose() {
    final stateSubscription = _stateSubscription;
    if (stateSubscription != null) unawaited(stateSubscription.cancel());
    final positionSubscription = _positionSubscription;
    if (positionSubscription != null) {
      unawaited(positionSubscription.cancel());
    }
    unawaited(_player.dispose());
    super.dispose();
  }

  Future<void> _toggle() async {
    if (_loading) return;
    if (_playing) {
      await _player.pause();
      return;
    }
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      if (_loadedUrl != widget.url) {
        await _player.setUrl(widget.url);
        _loadedUrl = widget.url;
      }
      if (_player.processingState == ProcessingState.completed) {
        await _player.seek(Duration.zero);
      }
      unawaited(_player.play());
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final totalSeconds = widget.durationSeconds ?? 0;
    final elapsedSeconds = totalSeconds <= 0
        ? _position.inSeconds
        : _position.inSeconds.clamp(0, totalSeconds);
    final progress = totalSeconds <= 0 ? 0.0 : elapsedSeconds / totalSeconds;
    final elapsed = formatVoiceDuration(elapsedSeconds);
    final duration = totalSeconds <= 0
        ? elapsed
        : (_playing || _position > Duration.zero)
            ? elapsed
            : formatVoiceDuration(totalSeconds);
    return Semantics(
      container: true,
      label: "${widget.semanticLabel}, $duration",
      child: SizedBox(
        key: widget.bubbleKey,
        width: 232,
        height: 44,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: colors.elevatedSurface,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(2, 2, 8, 2),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  tooltip: _playing
                      ? "Pause ${widget.semanticLabel.toLowerCase()}"
                      : "Play ${widget.semanticLabel.toLowerCase()}",
                  onPressed: _toggle,
                  constraints: const BoxConstraints.tightFor(
                    width: 38,
                    height: 38,
                  ),
                  padding: EdgeInsets.zero,
                  icon: _loading
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(
                          _playing
                              ? Icons.pause_rounded
                              : Icons.play_arrow_rounded,
                        ),
                ),
                Expanded(
                  child: SizedBox(
                    height: 22,
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final barCount = (constraints.maxWidth / 5)
                            .floor()
                            .clamp(4, 14)
                            .toInt();
                        return Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: List.generate(barCount, (index) {
                            final filled = index / barCount <= progress;
                            return Container(
                              width: 3,
                              height: 7.0 + ((index * 5) % 18),
                              decoration: BoxDecoration(
                                color: filled
                                    ? colors.primaryAction
                                    : colors.border,
                                borderRadius: BorderRadius.circular(2),
                              ),
                            );
                          }),
                        );
                      },
                    ),
                  ),
                ),
                const SizedBox(width: 5),
                Text(
                  _failed ? "Retry" : duration,
                  style: const TextStyle(fontSize: 11),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
