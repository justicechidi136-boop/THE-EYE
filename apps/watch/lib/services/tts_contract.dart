import 'package:flutter_tts/flutter_tts.dart';

import '../alerts/danger_alert_models.dart';

enum TtsPurpose {
  dangerAlert('danger_alert'),
  notification('notification'),
  message('message'),
  accessibility('accessibility'),
  general('general');

  const TtsPurpose(this.wireValue);
  final String wireValue;
}

enum TtsPriority { low, normal, high, critical }

enum TtsFallbackReason {
  none,
  voiceUnavailable,
  providerUnavailable,
  disabled,
}

class TtsRequest {
  const TtsRequest({
    required this.text,
    required this.locale,
    required this.purpose,
    this.priority = TtsPriority.normal,
    this.contentId,
  });

  final String text;
  final String locale;
  final TtsPurpose purpose;
  final TtsPriority priority;
  final String? contentId;
}

class TtsPlaybackResult {
  const TtsPlaybackResult({
    required this.provenance,
    required this.requestedLocale,
    required this.appliedLocale,
    required this.purpose,
    required this.priority,
    required this.spoken,
    this.contentId,
    this.fallbackReason = TtsFallbackReason.none,
    this.provider = 'local-device',
  });

  final String provenance;
  final String requestedLocale;
  final String appliedLocale;
  final TtsPurpose purpose;
  final TtsPriority priority;
  final String? contentId;
  final bool spoken;
  final TtsFallbackReason fallbackReason;
  final String provider;

  bool get usedFallback => fallbackReason != TtsFallbackReason.none;
}

abstract interface class LocalTtsProvider {
  Future<void> initialize();
  Future<void> stop();
  Future<bool> isLanguageAvailable(String localeTag);
  Future<void> setLanguage(String localeTag);
  Future<void> setSpeechRate(double rate);
  Future<void> setPitch(double pitch);
  Future<void> speak(String text);
}

class FlutterLocalTtsProvider implements LocalTtsProvider {
  FlutterLocalTtsProvider({FlutterTts? tts}) : _tts = tts ?? FlutterTts();

  final FlutterTts _tts;
  bool _initialized = false;

  @override
  Future<void> initialize() async {
    if (_initialized) return;
    await _tts.awaitSpeakCompletion(true);
    await _tts.setVolume(1.0);
    _initialized = true;
  }

  @override
  Future<bool> isLanguageAvailable(String localeTag) async {
    final result = await _tts.isLanguageAvailable(localeTag);
    return result == true;
  }

  @override
  Future<void> setLanguage(String localeTag) => _tts.setLanguage(localeTag);

  @override
  Future<void> setPitch(double pitch) => _tts.setPitch(pitch);

  @override
  Future<void> setSpeechRate(double rate) => _tts.setSpeechRate(rate);

  @override
  Future<void> speak(String text) => _tts.speak(text);

  @override
  Future<void> stop() => _tts.stop();
}

class WatchTtsVoiceResolver {
  const WatchTtsVoiceResolver();

  String localeFor(String code) => SpokenLanguageCodes.ttsLocale(code);
}
