import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/services.dart';
import 'package:the_eye_watch/alerts/danger_alert_models.dart';
import 'package:the_eye_watch/services/danger_alert_coordinator.dart';
import 'package:the_eye_watch/services/danger_alert_tts_service.dart';
import 'package:the_eye_watch/services/tts_contract.dart';
import 'package:the_eye_watch/services/vibration_service.dart';

import 'danger_alert_tts_service_test.dart';

DangerAlertPayload _payload({
  DangerAlertPriority priority = DangerAlertPriority.high,
  String alertId = 'alert-1',
}) {
  final issuedAt = DateTime.utc(2026, 8, 16, 10);
  return DangerAlertPayload(
    schemaVersion: 1,
    alertId: alertId,
    version: 1,
    sequence: 1,
    lifecycleState: DangerAlertLifecycleState.active,
    alertCode: DangerAlertCodes.armedRobberyNearby,
    priority: priority,
    incidentId: 'incident-1',
    zoneId: 'zone-1',
    safetyAlertId: 'safety-1',
    issuedAt: issuedAt,
    issuedAtWire: issuedAt.toIso8601String(),
    areaName: 'Ikeja',
    distanceMeters: 300,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('com.theeye.watch/vibration'),
      (_) async => null,
    );
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('com.theeye.watch/vibration'),
      null,
    );
  });

  group('DangerAlertCoordinator spoken safety', () {
    test('critical trusted alerts speak even during quiet hours', () async {
      final provider = FakeLocalTtsProvider(availableLanguages: {'en-NG'});
      final tts = DangerAlertTtsService(provider: provider);
      final events = <DangerAlertTelemetryEvent>[];
      final coordinator = DangerAlertCoordinator(
        vibration: VibrationService(),
        tts: tts,
        requireSignature: false,
        onTelemetry: (event, {alertId, reason}) => events.add(event),
      );
      coordinator.updatePreferences(
        const WatchAccessibilityPreferences(
          quietHoursStart: '00:00',
          quietHoursEnd: '23:59',
          allowCriticalAlertDuringQuietHours: true,
        ),
      );

      await coordinator.handleIncoming(
        _payload(priority: DangerAlertPriority.critical),
      );

      expect(provider.spoken, hasLength(1));
      expect(tts.lastResult?.provenance, 'SYNTHESIZED_SPEECH');
      expect(events, contains(DangerAlertTelemetryEvent.speechCompleted));
    });

    test('medium alerts respect quiet hours', () async {
      final provider = FakeLocalTtsProvider(availableLanguages: {'en-NG'});
      final coordinator = DangerAlertCoordinator(
        vibration: VibrationService(),
        tts: DangerAlertTtsService(provider: provider),
        requireSignature: false,
      );
      coordinator.updatePreferences(
        const WatchAccessibilityPreferences(
          quietHoursStart: '00:00',
          quietHoursEnd: '23:59',
        ),
      );

      await coordinator.handleIncoming(
        _payload(priority: DangerAlertPriority.medium),
      );

      expect(provider.spoken, isEmpty);
    });

    test('mute stops replay speech', () async {
      final provider = FakeLocalTtsProvider(availableLanguages: {'en-NG'});
      final coordinator = DangerAlertCoordinator(
        vibration: VibrationService(),
        tts: DangerAlertTtsService(provider: provider),
        requireSignature: false,
      );

      await coordinator.handleIncoming(_payload());
      await coordinator.muteActive();
      await coordinator.replayActive();

      expect(provider.spoken, hasLength(1));
    });

    test('provider unavailable emits telemetry without crashing alert display',
        () async {
      final provider = FakeLocalTtsProvider(availableLanguages: {'en-NG'})
        ..failSpeak = true;
      final events = <DangerAlertTelemetryEvent>[];
      final coordinator = DangerAlertCoordinator(
        vibration: VibrationService(),
        tts: DangerAlertTtsService(provider: provider),
        requireSignature: false,
        onTelemetry: (event, {alertId, reason}) => events.add(event),
      );

      await coordinator.handleIncoming(_payload());

      expect(events, contains(DangerAlertTelemetryEvent.ttsUnavailable));
    });

    test('critical speech uses critical TTS priority metadata', () async {
      final provider = FakeLocalTtsProvider(availableLanguages: {'en-NG'});
      final tts = DangerAlertTtsService(provider: provider);
      final coordinator = DangerAlertCoordinator(
        vibration: VibrationService(),
        tts: tts,
        requireSignature: false,
      );

      await coordinator.handleIncoming(
        _payload(priority: DangerAlertPriority.critical),
      );

      expect(tts.lastResult?.provenance, 'SYNTHESIZED_SPEECH');
      expect(tts.lastResult?.purpose, TtsPurpose.dangerAlert);
      expect(tts.lastResult?.priority, TtsPriority.critical);
      expect(tts.lastResult?.contentId, 'alert-1');
    });
  });
}
