import 'dart:async';

import 'package:flutter_tts/flutter_tts.dart';

import '../alerts/danger_alert_models.dart';

enum DangerAlertTtsOutcome {
  started,
  completed,
  unavailable,
  fallbackLanguage,
  skipped,
}

class DangerAlertTtsService {
  DangerAlertTtsService({FlutterTts? tts}) : _tts = tts ?? FlutterTts();

  final FlutterTts _tts;
  bool _initialized = false;
  String? _lastSpokenKey;
  String? _activeLanguage;
  bool _languageUnavailable = false;

  bool get languageUnavailable => _languageUnavailable;
  String? get activeLanguage => _activeLanguage;

  Future<void> initialize() async {
    if (_initialized) return;
    await _tts.awaitSpeakCompletion(true);
    await _tts.setVolume(1.0);
    _initialized = true;
  }

  Future<void> dispose() async {
    await stop();
  }

  Future<void> stop() async {
    try {
      await _tts.stop();
    } catch (_) {}
  }

  Future<DangerAlertTtsOutcome> speak({
    required String text,
    required WatchAccessibilityPreferences preferences,
    required String dedupeKey,
    String? languageHint,
  }) async {
    if (!preferences.spokenDangerAlertsEnabled || text.trim().isEmpty) {
      return DangerAlertTtsOutcome.skipped;
    }

    if (_lastSpokenKey == dedupeKey) {
      return DangerAlertTtsOutcome.skipped;
    }

    await initialize();
    await stop();

    final requested = languageHint ?? preferences.preferredSpokenLanguage;
    final locale = SpokenLanguageCodes.ttsLocale(requested);
    _languageUnavailable = false;

    var languageApplied = await _applyLanguage(locale);
    if (!languageApplied && preferences.autoLanguageFallback) {
      languageApplied = await _applyLanguage(SpokenLanguageCodes.ttsLocale(SpokenLanguageCodes.english));
      if (languageApplied && requested != SpokenLanguageCodes.english) {
        _languageUnavailable = true;
      }
    }

    if (!languageApplied) {
      _languageUnavailable = true;
      return DangerAlertTtsOutcome.unavailable;
    }

    await _tts.setSpeechRate(preferences.speechRate.clamp(0.2, 1.0));
    await _tts.setPitch(preferences.speechPitch.clamp(0.5, 2.0));

    _lastSpokenKey = dedupeKey;
    try {
      await _tts.speak(text);
      return _languageUnavailable
          ? DangerAlertTtsOutcome.fallbackLanguage
          : DangerAlertTtsOutcome.completed;
    } catch (_) {
      _languageUnavailable = true;
      return DangerAlertTtsOutcome.unavailable;
    }
  }

  Future<bool> _applyLanguage(String localeTag) async {
    try {
      final result = await _tts.isLanguageAvailable(localeTag);
      if (result != true) return false;
      await _tts.setLanguage(localeTag);
      _activeLanguage = localeTag;
      return true;
    } catch (_) {
      return false;
    }
  }

  void clearDedupe() => _lastSpokenKey = null;
}
