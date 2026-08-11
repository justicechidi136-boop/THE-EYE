import "dart:async";

import "package:just_audio/just_audio.dart";

/// Plays local evidence audio files (picked or recorded attachments).
class EvidenceAudioPreviewPlayer {
  EvidenceAudioPreviewPlayer({AudioPlayer? player})
      : _player = player ?? AudioPlayer();

  final AudioPlayer _player;
  String? _playingLocalId;
  StreamSubscription<ProcessingState>? _completionSub;

  String? get playingLocalId => _playingLocalId;

  bool isPlaying(String localId) =>
      _playingLocalId == localId && _player.playing;

  Future<void> toggle(String localId, String filePath) async {
    if (_playingLocalId == localId && _player.playing) {
      await pause();
      return;
    }
    await play(localId, filePath);
  }

  Future<void> play(String localId, String filePath) async {
    await _completionSub?.cancel();
    if (_playingLocalId != localId) {
      await _player.stop();
      await _player.setFilePath(filePath);
    }
    _playingLocalId = localId;
    await _player.play();
    _completionSub = _player.processingStateStream.listen((state) {
      if (state == ProcessingState.completed) {
        unawaited(_player.seek(Duration.zero));
        unawaited(_player.pause());
      }
    });
  }

  Future<void> pause() async {
    await _player.pause();
  }

  Future<void> stop() async {
    await _completionSub?.cancel();
    _completionSub = null;
    _playingLocalId = null;
    await _player.stop();
  }

  Future<void> dispose() async {
    await _completionSub?.cancel();
    await _player.dispose();
  }
}
