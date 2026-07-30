import "dart:async";
import "dart:io";

import "package:flutter/material.dart";
import "package:flutter/semantics.dart";
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
import "voice_accessibility_guide.dart";
import "voice_report_validation.dart";

typedef VoiceRecorderAccessibilityAnnouncer = void Function(String message);

class VoiceRecorder extends StatefulWidget {
  const VoiceRecorder({
    required this.onRecordingReady,
    this.onRecordingRemoved,
    this.selectedLanguage = "auto",
    this.accessibilityVoiceGuidance = false,
    this.enabled = true,
    super.key,
  });

  final ValueChanged<VoiceRecordingResult> onRecordingReady;
  final VoidCallback? onRecordingRemoved;
  final String selectedLanguage;
  final bool accessibilityVoiceGuidance;
  final bool enabled;

  @override
  State<VoiceRecorder> createState() => _VoiceRecorderState();
}

class _VoiceRecorderState extends State<VoiceRecorder> {
  final AudioRecorder _recorder = AudioRecorder();
  final AudioPlayer _player = AudioPlayer();
  VoiceRecorderState _state = VoiceRecorderState.idle;
  String? _filePath;
  int _elapsedSeconds = 0;
  Timer? _timer;
  String? _errorMessage;
  double _uploadProgress = 0;

  @override
  void dispose() {
    _timer?.cancel();
    unawaited(_recorder.dispose());
    unawaited(_player.dispose());
    super.dispose();
  }

  Future<void> _announce(String message) async {
    if (!mounted) return;
    SemanticsService.sendAnnouncement(View.of(context), message, TextDirection.ltr);
    if (widget.accessibilityVoiceGuidance) {
      await speakVoiceAccessibilityGuidance(message);
    }
  }

  Future<bool> _ensureMicPermission() async {
    final status = await Permission.microphone.request();
    if (status.isGranted) return true;
    setState(() {
      _state = VoiceRecorderState.failed;
      _errorMessage = "Microphone permission is required to record a voice report.";
    });
    await _announce("Microphone permission denied.");
    return false;
  }

  Future<void> _startRecording() async {
    if (!widget.enabled || _state == VoiceRecorderState.uploading) return;
    if (!await _ensureMicPermission()) return;

    final dir = await getTemporaryDirectory();
    final fileName = "voice-${const Uuid().v4()}.m4a";
    final path = p.join(dir.path, fileName);

    await _recorder.start(
      const RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 64000,
        sampleRate: 44100,
        numChannels: 1,
      ),
      path: path,
    );

    _timer?.cancel();
    _elapsedSeconds = 0;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() => _elapsedSeconds += 1);
      if (_elapsedSeconds >= voiceMaxDurationSeconds) {
        unawaited(_stopRecording(autoStopped: true));
      }
    });

    setState(() {
      _state = VoiceRecorderState.recording;
      _filePath = path;
      _errorMessage = null;
    });
    HapticFeedback.mediumImpact();
    await _announce("Recording started. Tap stop when you finish.");
  }

  Future<void> _pauseRecording() async {
    if (_state != VoiceRecorderState.recording) return;
    await _recorder.pause();
    _timer?.cancel();
    setState(() => _state = VoiceRecorderState.paused);
    await _announce("Recording paused.");
  }

  Future<void> _resumeRecording() async {
    if (_state != VoiceRecorderState.paused) return;
    await _recorder.resume();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() => _elapsedSeconds += 1);
      if (_elapsedSeconds >= voiceMaxDurationSeconds) {
        unawaited(_stopRecording(autoStopped: true));
      }
    });
    setState(() => _state = VoiceRecorderState.recording);
    await _announce("Recording resumed.");
  }

  Future<void> _stopRecording({bool autoStopped = false}) async {
    if (_state != VoiceRecorderState.recording && _state != VoiceRecorderState.paused) {
      return;
    }
    _timer?.cancel();
    final path = await _recorder.stop();
    final resolvedPath = path ?? _filePath;
    if (resolvedPath == null || !File(resolvedPath).existsSync()) {
      setState(() {
        _state = VoiceRecorderState.failed;
        _errorMessage = "Recording failed. Please try again.";
      });
      return;
    }

    final file = File(resolvedPath);
    final sizeBytes = await file.length();
    if (sizeBytes <= 0 || sizeBytes > voiceMaxFileBytes) {
      setState(() {
        _state = VoiceRecorderState.failed;
        _errorMessage = "Recording is empty or too large.";
      });
      return;
    }

    setState(() {
      _state = VoiceRecorderState.recorded;
      _filePath = resolvedPath;
      if (_elapsedSeconds <= 0) _elapsedSeconds = 1;
    });
    HapticFeedback.lightImpact();
    await _announce(autoStopped
        ? "Maximum recording length reached. Your voice report is ready."
        : "Your voice report is ready.");
    await _finalizeAttachment(resolvedPath, sizeBytes);
  }

  Future<void> _finalizeAttachment(String path, int sizeBytes) async {
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
      durationSeconds: _elapsedSeconds,
      metadata: {
        "selectedLanguage": widget.selectedLanguage,
        "voiceReport": true,
      },
    );
    widget.onRecordingReady(
      VoiceRecordingResult(
        attachment: attachment,
        durationSeconds: _elapsedSeconds,
        selectedLanguage: widget.selectedLanguage,
      ),
    );
  }

  Future<void> _playRecording() async {
    if (_filePath == null) return;
    setState(() => _state = VoiceRecorderState.playing);
    await _player.setFilePath(_filePath!);
    await _player.play();
    _player.processingStateStream.firstWhere((state) => state == ProcessingState.completed).then((_) {
      if (!mounted) return;
      setState(() => _state = VoiceRecorderState.recorded);
    });
  }

  Future<void> _deleteRecording() async {
    _timer?.cancel();
    await _player.stop();
    if (_filePath != null) {
      final file = File(_filePath!);
      if (file.existsSync()) await file.delete();
    }
    setState(() {
      _state = VoiceRecorderState.idle;
      _filePath = null;
      _elapsedSeconds = 0;
      _errorMessage = null;
    });
    widget.onRecordingRemoved?.call();
    await _announce("Recording deleted.");
  }

  Future<void> _retry() async {
    setState(() {
      _state = VoiceRecorderState.idle;
      _errorMessage = null;
      _uploadProgress = 0;
    });
    await _announce("Tap the microphone to start recording.");
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final isRecording = _state == VoiceRecorderState.recording;
    final isPaused = _state == VoiceRecorderState.paused;
    final hasRecording = _state == VoiceRecorderState.recorded || _state == VoiceRecorderState.playing;

    return Semantics(
      container: true,
      label: "Voice report recorder",
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: colors.elevatedSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isRecording ? colors.error : colors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    _stateLabel(),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                Text(
                  formatVoiceDuration(_elapsedSeconds),
                  semanticsLabel: "Recording duration ${formatVoiceDuration(_elapsedSeconds)}",
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
            const SizedBox(height: 12),
            _LevelIndicator(active: isRecording || isPaused),
            const SizedBox(height: 16),
            Center(
              child: Semantics(
                button: true,
                label: isRecording ? "Stop recording" : "Start voice recording",
                child: Material(
                  color: isRecording ? colors.error : colors.primaryAction,
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: !widget.enabled
                        ? null
                        : isRecording
                            ? _stopRecording
                            : (_state == VoiceRecorderState.idle || _state == VoiceRecorderState.failed)
                                ? _startRecording
                                : null,
                    child: SizedBox(
                      width: 88,
                      height: 88,
                      child: Icon(
                        isRecording ? Icons.stop_rounded : Icons.mic_rounded,
                        color: Colors.white,
                        size: 40,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: [
                if (isRecording)
                  _ActionChip(
                    label: "Pause",
                    icon: Icons.pause_rounded,
                    onPressed: _pauseRecording,
                  ),
                if (isPaused)
                  _ActionChip(
                    label: "Resume",
                    icon: Icons.play_arrow_rounded,
                    onPressed: _resumeRecording,
                  ),
                if (hasRecording) ...[
                  _ActionChip(label: "Play", icon: Icons.play_circle_outline, onPressed: _playRecording),
                  _ActionChip(label: "Delete", icon: Icons.delete_outline, onPressed: _deleteRecording),
                  _ActionChip(label: "Re-record", icon: Icons.refresh_rounded, onPressed: () async {
                    await _deleteRecording();
                    await _startRecording();
                  }),
                ],
                if (_state == VoiceRecorderState.failed)
                  _ActionChip(label: "Retry", icon: Icons.replay_rounded, onPressed: _retry),
              ],
            ),
            if (_state == VoiceRecorderState.uploading) ...[
              const SizedBox(height: 12),
              LinearProgressIndicator(value: _uploadProgress > 0 ? _uploadProgress : null),
              const SizedBox(height: 4),
              Text("Uploading voice report...", style: Theme.of(context).textTheme.bodySmall),
            ],
            if (_errorMessage != null) ...[
              const SizedBox(height: 8),
              Text(_errorMessage!, style: TextStyle(color: colors.error)),
            ],
            const SizedBox(height: 8),
            Text(
              "You can submit with voice only. Typed text is optional when a voice recording is attached.",
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }

  String _stateLabel() {
    switch (_state) {
      case VoiceRecorderState.idle:
        return "Tap microphone to record";
      case VoiceRecorderState.recording:
        return "Recording…";
      case VoiceRecorderState.paused:
        return "Paused";
      case VoiceRecorderState.recorded:
        return "Voice report ready";
      case VoiceRecorderState.playing:
        return "Playing back";
      case VoiceRecorderState.uploading:
        return "Uploading";
      case VoiceRecorderState.uploaded:
        return "Uploaded";
      case VoiceRecorderState.failed:
        return "Recording failed";
      case VoiceRecorderState.offlinePending:
        return "Saved offline — will upload when connected";
    }
  }
}

class _LevelIndicator extends StatelessWidget {
  const _LevelIndicator({required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(8, (index) {
        return AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          margin: const EdgeInsets.symmetric(horizontal: 2),
          width: 8,
          height: active ? 12 + (index % 3) * 8 : 8,
          decoration: BoxDecoration(
            color: active ? EyeSemanticColors.of(context).primaryAction : EyeSemanticColors.of(context).border,
            borderRadius: BorderRadius.circular(4),
          ),
        );
      }),
    );
  }
}

class _ActionChip extends StatelessWidget {
  const _ActionChip({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: OutlinedButton.icon(onPressed: onPressed, icon: Icon(icon), label: Text(label)),
    );
  }
}
