import "dart:async";

import "package:flutter/foundation.dart";
import "package:flutter_tts/flutter_tts.dart";
import "package:just_audio/just_audio.dart";
import "package:shared_preferences/shared_preferences.dart";

import "incoming_danger_alert.dart";

enum DangerAlertAudioState {
  idle,
  alerting,
  speakingWarning,
  playingOriginalVoice,
  originalVoiceFailed,
  completed,
}

abstract interface class DangerWarningSpeaker {
  Future<void> speak(String text, String locale);
  Future<void> stop();
}

class FlutterDangerWarningSpeaker implements DangerWarningSpeaker {
  FlutterDangerWarningSpeaker({FlutterTts? tts}) : _tts = tts ?? FlutterTts();

  final FlutterTts _tts;

  @override
  Future<void> speak(String text, String locale) async {
    await _tts.awaitSpeakCompletion(true);
    final available = await _tts.isLanguageAvailable(locale) == true;
    await _tts.setLanguage(available ? locale : "en-NG");
    await _tts.setSpeechRate(0.45);
    await _tts.setPitch(1.0);
    await _tts.setVolume(1.0);
    await _tts.speak(text);
  }

  @override
  Future<void> stop() => _tts.stop();
}

abstract interface class OriginalVoicePlayer {
  Future<void> play(String signedUrl);
  Future<void> pause();
  Future<void> stop();
  Future<void> dispose();
}

class JustAudioOriginalVoicePlayer implements OriginalVoicePlayer {
  JustAudioOriginalVoicePlayer({AudioPlayer? player})
      : _player = player ?? AudioPlayer();

  final AudioPlayer _player;

  @override
  Future<void> play(String signedUrl) async {
    await _player.setUrl(signedUrl);
    await _player.play();
  }

  @override
  Future<void> pause() => _player.pause();

  @override
  Future<void> stop() => _player.stop();

  @override
  Future<void> dispose() => _player.dispose();
}

abstract interface class DangerAudioCompletionStore {
  Future<bool> contains(String key);
  Future<void> add(String key);
}

class SharedPreferencesDangerAudioCompletionStore
    implements DangerAudioCompletionStore {
  static const _key = "danger_alert.completed_audio_revisions";

  @override
  Future<bool> contains(String key) async {
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getStringList(_key) ?? const <String>[]).contains(key);
  }

  @override
  Future<void> add(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final values = prefs.getStringList(_key) ?? <String>[];
    if (!values.contains(key)) values.add(key);
    await prefs.setStringList(
      _key,
      values.length <= 100 ? values : values.sublist(values.length - 100),
    );
  }
}

typedef OriginalVoiceUrlLoader = Future<String?> Function();
typedef DangerAudioTrace = void Function(String event);

class DangerAlertAudioCoordinator {
  DangerAlertAudioCoordinator({
    DangerWarningSpeaker? warningSpeaker,
    OriginalVoicePlayer? originalVoicePlayer,
    DangerAudioCompletionStore? completionStore,
    DangerAudioTrace? trace,
  })  : _warningSpeaker = warningSpeaker ?? FlutterDangerWarningSpeaker(),
        _originalVoicePlayer =
            originalVoicePlayer ?? JustAudioOriginalVoicePlayer(),
        _completionStore =
            completionStore ?? SharedPreferencesDangerAudioCompletionStore(),
        _trace = trace;

  final DangerWarningSpeaker _warningSpeaker;
  final OriginalVoicePlayer _originalVoicePlayer;
  final DangerAudioCompletionStore _completionStore;
  final DangerAudioTrace? _trace;
  final ValueNotifier<DangerAlertAudioState> state = ValueNotifier(
    DangerAlertAudioState.idle,
  );

  IncomingDangerAlert? _active;
  int _generation = 0;

  Future<bool> playAutomatic(
    IncomingDangerAlert alert, {
    required String locale,
    required OriginalVoiceUrlLoader loadOriginalVoice,
  }) async {
    if (await _completionStore.contains(alert.dedupeKey)) {
      _trace?.call("AUTOPLAY_SUPPRESSED_COMPLETED");
      return false;
    }
    final active = _active;
    if (active != null && !_shouldInterrupt(active, alert)) return false;

    await stop(markIdle: false);
    _active = alert;
    final generation = ++_generation;
    state.value = DangerAlertAudioState.alerting;
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (!_isCurrent(generation, alert)) return false;

    state.value = DangerAlertAudioState.speakingWarning;
    _trace?.call("SPEAKING_WARNING");
    await _warningSpeaker.speak(alert.spokenText, locale);
    _trace?.call("TTS_COMPLETED");
    if (!_isCurrent(generation, alert)) return false;
    await _warningSpeaker.stop();

    if (alert.hasOriginalVoice) {
      final played = await _playOriginalVoice(
        alert,
        generation: generation,
        loadOriginalVoice: loadOriginalVoice,
      );
      if (!played) {
        if (_isCurrent(generation, alert)) {
          state.value = DangerAlertAudioState.originalVoiceFailed;
          _active = null;
        }
        return false;
      }
    } else {
      _trace?.call("VOICE_NOT_AVAILABLE");
    }

    state.value = DangerAlertAudioState.completed;
    await _completionStore.add(alert.dedupeKey);
    _trace?.call("AUTOPLAY_COMPLETED");
    _active = null;
    return true;
  }

  Future<void> replay(
    IncomingDangerAlert alert, {
    required String locale,
    required OriginalVoiceUrlLoader loadOriginalVoice,
  }) async {
    await stop(markIdle: false);
    _active = alert;
    final generation = ++_generation;
    state.value = DangerAlertAudioState.speakingWarning;
    await _warningSpeaker.speak(alert.spokenText, locale);
    if (!_isCurrent(generation, alert)) return;
    await _warningSpeaker.stop();
    if (alert.hasOriginalVoice) {
      await _playOriginalVoice(
        alert,
        generation: generation,
        loadOriginalVoice: loadOriginalVoice,
      );
    }
    if (_isCurrent(generation, alert)) {
      state.value = DangerAlertAudioState.completed;
      _active = null;
    }
  }

  Future<void> acknowledge() => stop();

  Future<bool> playOriginalVoice(
    IncomingDangerAlert alert, {
    required OriginalVoiceUrlLoader loadOriginalVoice,
  }) async {
    await stop(markIdle: false);
    _active = alert;
    final generation = ++_generation;
    final played = await _playOriginalVoice(
      alert,
      generation: generation,
      loadOriginalVoice: loadOriginalVoice,
    );
    if (_isCurrent(generation, alert)) {
      state.value = played
          ? DangerAlertAudioState.completed
          : DangerAlertAudioState.originalVoiceFailed;
      _active = null;
    }
    return played;
  }

  Future<bool> _playOriginalVoice(
    IncomingDangerAlert alert, {
    required int generation,
    required OriginalVoiceUrlLoader loadOriginalVoice,
  }) async {
    for (var attempt = 0; attempt < 2; attempt++) {
      _trace?.call("VOICE_ACCESS_REQUESTED");
      final signedUrl = await loadOriginalVoice();
      if (!_isCurrent(generation, alert)) return false;
      if (signedUrl == null || signedUrl.isEmpty) {
        _trace?.call("VOICE_ACCESS_UNAVAILABLE");
        continue;
      }
      try {
        state.value = DangerAlertAudioState.playingOriginalVoice;
        _trace?.call("VOICE_PLAYING");
        await _originalVoicePlayer.play(signedUrl);
        _trace?.call("VOICE_COMPLETED");
        return _isCurrent(generation, alert);
      } catch (error) {
        _trace?.call("VOICE_PLAYBACK_FAILED:${error.runtimeType}");
        await _originalVoicePlayer.stop();
      }
    }
    return false;
  }

  Future<void> stop({bool markIdle = true}) async {
    _generation += 1;
    await _warningSpeaker.stop();
    await _originalVoicePlayer.stop();
    _active = null;
    if (markIdle) state.value = DangerAlertAudioState.idle;
  }

  Future<void> dispose() async {
    await stop();
    state.dispose();
    await _originalVoicePlayer.dispose();
  }

  bool _isCurrent(int generation, IncomingDangerAlert alert) =>
      generation == _generation && _active?.dedupeKey == alert.dedupeKey;

  bool _shouldInterrupt(IncomingDangerAlert current, IncomingDangerAlert next) {
    if (next.priorityRank != current.priorityRank) {
      return next.priorityRank > current.priorityRank;
    }
    return next.issuedAt.isAfter(current.issuedAt);
  }
}
