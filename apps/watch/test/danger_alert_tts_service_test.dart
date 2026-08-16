import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/alerts/danger_alert_models.dart';
import 'package:the_eye_watch/services/danger_alert_tts_service.dart';
import 'package:the_eye_watch/services/tts_contract.dart';

class FakeLocalTtsProvider implements LocalTtsProvider {
  FakeLocalTtsProvider({Set<String>? availableLanguages})
      : availableLanguages = availableLanguages ?? {'en-NG'};

  final Set<String> availableLanguages;
  final spoken = <String>[];
  final appliedLanguages = <String>[];
  var stopCount = 0;
  var failSpeak = false;

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> isLanguageAvailable(String localeTag) async =>
      availableLanguages.contains(localeTag);

  @override
  Future<void> setLanguage(String localeTag) async {
    appliedLanguages.add(localeTag);
  }

  @override
  Future<void> setPitch(double pitch) async {}

  @override
  Future<void> setSpeechRate(double rate) async {}

  @override
  Future<void> speak(String text) async {
    if (failSpeak) throw StateError('tts unavailable');
    spoken.add(text);
  }

  @override
  Future<void> stop() async {
    stopCount += 1;
  }
}

void main() {
  group('DangerAlertTtsService Wave 7', () {
    test('selects native voices for English Hausa Yoruba and Igbo', () async {
      final provider = FakeLocalTtsProvider(
        availableLanguages: {'en-NG', 'ha-NG', 'yo-NG', 'ig-NG'},
      );
      final service = DangerAlertTtsService(provider: provider);

      for (final entry in {
        SpokenLanguageCodes.english: 'en-NG',
        SpokenLanguageCodes.hausa: 'ha-NG',
        SpokenLanguageCodes.yoruba: 'yo-NG',
        SpokenLanguageCodes.igbo: 'ig-NG',
      }.entries) {
        final outcome = await service.speak(
          text: 'Trusted alert',
          preferences: WatchAccessibilityPreferences(
            preferredSpokenLanguage: entry.key,
          ),
          dedupeKey: 'alert-${entry.key}',
          languageHint: entry.key,
        );
        expect(outcome, DangerAlertTtsOutcome.completed);
        expect(service.lastResult?.requestedLocale, entry.key);
        expect(service.lastResult?.appliedLocale, entry.value);
        expect(service.lastResult?.provenance, 'SYNTHESIZED_SPEECH');
      }
    });

    test('Pidgin requests fall back to approved English Nigerian voice',
        () async {
      final provider = FakeLocalTtsProvider(availableLanguages: {'en-NG'});
      final service = DangerAlertTtsService(provider: provider);

      final outcome = await service.speak(
        text: 'Danger dey near you',
        preferences: const WatchAccessibilityPreferences(),
        dedupeKey: 'pidgin-1',
        languageHint: SpokenLanguageCodes.nigerianPidgin,
      );

      expect(outcome, DangerAlertTtsOutcome.fallbackLanguage);
      expect(service.lastResult?.requestedLocale,
          SpokenLanguageCodes.nigerianPidgin);
      expect(service.lastResult?.appliedLocale, 'en-NG');
      expect(service.lastResult?.fallbackReason,
          TtsFallbackReason.voiceUnavailable);
      expect(service.lastResult?.usedFallback, isTrue);
    });

    test('unsupported requested locale falls back with metadata', () async {
      final provider = FakeLocalTtsProvider(availableLanguages: {'en-NG'});
      final service = DangerAlertTtsService(provider: provider);

      final outcome = await service.speak(
        text: 'Ina bukatar taimako',
        preferences: const WatchAccessibilityPreferences(),
        dedupeKey: 'ha-1',
        languageHint: SpokenLanguageCodes.hausa,
      );

      expect(outcome, DangerAlertTtsOutcome.fallbackLanguage);
      expect(service.lastResult?.requestedLocale, SpokenLanguageCodes.hausa);
      expect(service.lastResult?.appliedLocale, 'en-NG');
      expect(service.lastResult?.fallbackReason,
          TtsFallbackReason.voiceUnavailable);
    });

    test('spoken alerts can be disabled without provider speech', () async {
      final provider = FakeLocalTtsProvider(availableLanguages: {'en-NG'});
      final service = DangerAlertTtsService(provider: provider);

      final outcome = await service.speak(
        text: 'Trusted alert',
        preferences: const WatchAccessibilityPreferences(
          spokenDangerAlertsEnabled: false,
        ),
        dedupeKey: 'disabled-1',
      );

      expect(outcome, DangerAlertTtsOutcome.skipped);
      expect(provider.spoken, isEmpty);
      expect(service.lastResult?.fallbackReason, TtsFallbackReason.disabled);
    });

    test('provider unavailable reports unavailable and does not claim speech',
        () async {
      final provider = FakeLocalTtsProvider(availableLanguages: {'en-NG'})
        ..failSpeak = true;
      final service = DangerAlertTtsService(provider: provider);

      final outcome = await service.speak(
        text: 'Trusted alert',
        preferences: const WatchAccessibilityPreferences(),
        dedupeKey: 'failure-1',
      );

      expect(outcome, DangerAlertTtsOutcome.unavailable);
      expect(service.lastResult?.spoken, isFalse);
      expect(service.lastResult?.fallbackReason,
          TtsFallbackReason.providerUnavailable);
    });

    test('dedupe skips duplicate speech and replay can use another key',
        () async {
      final provider = FakeLocalTtsProvider(availableLanguages: {'en-NG'});
      final service = DangerAlertTtsService(provider: provider);

      await service.speak(
        text: 'Trusted alert',
        preferences: const WatchAccessibilityPreferences(),
        dedupeKey: 'alert-1',
      );
      final duplicate = await service.speak(
        text: 'Trusted alert',
        preferences: const WatchAccessibilityPreferences(),
        dedupeKey: 'alert-1',
      );
      final replay = await service.speak(
        text: 'Trusted alert',
        preferences: const WatchAccessibilityPreferences(),
        dedupeKey: 'alert-1:replay',
      );

      expect(duplicate, DangerAlertTtsOutcome.skipped);
      expect(replay, DangerAlertTtsOutcome.completed);
      expect(provider.spoken, hasLength(2));
    });

    test('generated TTS metadata never represents original audio', () async {
      final provider = FakeLocalTtsProvider(availableLanguages: {'en-NG'});
      final service = DangerAlertTtsService(provider: provider);

      await service.speak(
        text: 'Trusted alert',
        preferences: const WatchAccessibilityPreferences(),
        dedupeKey: 'audio-integrity-1',
        contentId: 'original-voice-recording-1',
      );

      expect(service.lastResult?.provenance, 'SYNTHESIZED_SPEECH');
      expect(service.lastResult?.provenance, isNot('ORIGINAL'));
      expect(service.lastResult?.purpose, TtsPurpose.dangerAlert);
      expect(service.lastResult?.priority, TtsPriority.high);
      expect(service.lastResult?.contentId, 'original-voice-recording-1');
    });
  });
}
