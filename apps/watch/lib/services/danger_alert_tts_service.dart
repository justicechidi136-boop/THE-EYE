import 'dart:async';

import '../alerts/danger_alert_models.dart';
import 'tts_contract.dart';

enum DangerAlertTtsOutcome {
  started,
  completed,
  unavailable,
  fallbackLanguage,
  skipped,
}

class DangerAlertTtsService {
  DangerAlertTtsService({
    LocalTtsProvider? provider,
    WatchTtsVoiceResolver? voiceResolver,
  })  : _provider = provider ?? FlutterLocalTtsProvider(),
        _voiceResolver = voiceResolver ?? const WatchTtsVoiceResolver();

  final LocalTtsProvider _provider;
  final WatchTtsVoiceResolver _voiceResolver;
  String? _lastSpokenKey;
  String? _activeLanguage;
  bool _languageUnavailable = false;
  TtsPlaybackResult? _lastResult;

  bool get languageUnavailable => _languageUnavailable;
  String? get activeLanguage => _activeLanguage;
  TtsPlaybackResult? get lastResult => _lastResult;

  Future<void> initialize() => _provider.initialize();

  Future<void> dispose() async {
    await stop();
  }

  Future<void> stop() async {
    try {
      await _provider.stop();
    } catch (_) {}
  }

  Future<DangerAlertTtsOutcome> speak({
    required String text,
    required WatchAccessibilityPreferences preferences,
    required String dedupeKey,
    String? languageHint,
    TtsPurpose purpose = TtsPurpose.dangerAlert,
    TtsPriority priority = TtsPriority.high,
    String? contentId,
  }) async {
    final requested = languageHint ?? preferences.preferredSpokenLanguage;
    final request = TtsRequest(
      text: text,
      locale: requested,
      purpose: purpose,
      priority: priority,
      contentId: contentId,
    );

    if (!preferences.spokenDangerAlertsEnabled || text.trim().isEmpty) {
      _lastResult = TtsPlaybackResult(
        provenance: 'SYNTHESIZED_SPEECH',
        requestedLocale: request.locale,
        appliedLocale: request.locale,
        purpose: request.purpose,
        priority: request.priority,
        contentId: request.contentId,
        spoken: false,
        fallbackReason: TtsFallbackReason.disabled,
      );
      return DangerAlertTtsOutcome.skipped;
    }

    if (_lastSpokenKey == dedupeKey) {
      return DangerAlertTtsOutcome.skipped;
    }

    await initialize();
    await stop();

    final locale = _voiceResolver.localeFor(request.locale);
    _languageUnavailable = false;
    var appliedLocale = locale;
    var fallbackReason = locale == request.locale
        ? TtsFallbackReason.none
        : TtsFallbackReason.voiceUnavailable;
    _languageUnavailable = fallbackReason != TtsFallbackReason.none;

    var languageApplied = await _applyLanguage(locale);
    if (!languageApplied && preferences.autoLanguageFallback) {
      appliedLocale = _voiceResolver.localeFor(SpokenLanguageCodes.english);
      languageApplied = await _applyLanguage(appliedLocale);
      if (languageApplied && requested != SpokenLanguageCodes.english) {
        _languageUnavailable = true;
        fallbackReason = TtsFallbackReason.voiceUnavailable;
      }
    }

    if (!languageApplied) {
      _languageUnavailable = true;
      _lastResult = TtsPlaybackResult(
        provenance: 'SYNTHESIZED_SPEECH',
        requestedLocale: request.locale,
        appliedLocale: appliedLocale,
        purpose: request.purpose,
        priority: request.priority,
        contentId: request.contentId,
        spoken: false,
        fallbackReason: TtsFallbackReason.providerUnavailable,
      );
      return DangerAlertTtsOutcome.unavailable;
    }

    await _provider.setSpeechRate(preferences.speechRate.clamp(0.2, 1.0));
    await _provider.setPitch(preferences.speechPitch.clamp(0.5, 2.0));

    _lastSpokenKey = dedupeKey;
    try {
      await _provider.speak(text);
      _lastResult = TtsPlaybackResult(
        provenance: 'SYNTHESIZED_SPEECH',
        requestedLocale: request.locale,
        appliedLocale: appliedLocale,
        purpose: request.purpose,
        priority: request.priority,
        contentId: request.contentId,
        spoken: true,
        fallbackReason: fallbackReason,
      );
      return _languageUnavailable
          ? DangerAlertTtsOutcome.fallbackLanguage
          : DangerAlertTtsOutcome.completed;
    } catch (_) {
      _languageUnavailable = true;
      _lastResult = TtsPlaybackResult(
        provenance: 'SYNTHESIZED_SPEECH',
        requestedLocale: request.locale,
        appliedLocale: appliedLocale,
        purpose: request.purpose,
        priority: request.priority,
        contentId: request.contentId,
        spoken: false,
        fallbackReason: TtsFallbackReason.providerUnavailable,
      );
      return DangerAlertTtsOutcome.unavailable;
    }
  }

  Future<bool> _applyLanguage(String localeTag) async {
    try {
      final result = await _provider.isLanguageAvailable(localeTag);
      if (!result) return false;
      await _provider.setLanguage(localeTag);
      _activeLanguage = localeTag;
      return true;
    } catch (_) {
      return false;
    }
  }

  void clearDedupe() => _lastSpokenKey = null;
}
