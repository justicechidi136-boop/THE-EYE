import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:the_eye_watch/alerts/danger_alert_models.dart';
import 'package:the_eye_watch/services/alert_version_tracker.dart';
import 'package:the_eye_watch/storage/secure_credential_store.dart';

DangerAlertPayload _payload({
  required String alertId,
  required int version,
  DangerAlertLifecycleState state = DangerAlertLifecycleState.active,
  DangerAlertDeliverySource source = DangerAlertDeliverySource.fcm,
}) {
  return DangerAlertPayload(
    schemaVersion: 1,
    alertId: alertId,
    version: version,
    sequence: version,
    lifecycleState: state,
    alertCode: DangerAlertCodes.generalEntry,
    priority: DangerAlertPriority.high,
    incidentId: 'inc-1',
    zoneId: 'zone-1',
    safetyAlertId: 'sa-1',
    issuedAt: DateTime.now().toUtc(),
    issuedAtWire: DateTime.now().toUtc().toIso8601String(),
    deliverySource: source,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AlertVersionTracker', () {
    late PreferencesStore preferences;
    late AlertVersionTracker tracker;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      preferences = PreferencesStore();
      tracker = AlertVersionTracker(preferences: preferences);
    });

    test('accepts first delivery', () async {
      final decision = await tracker.evaluate(_payload(alertId: 'a1', version: 1));
      expect(decision, AlertVersionDecision.acceptFull);
    });

    test('suppresses duplicate version from second channel', () async {
      await tracker.record(_payload(
        alertId: 'a1',
        version: 1,
        source: DangerAlertDeliverySource.phoneRelay,
      ));
      final decision = await tracker.evaluate(_payload(
        alertId: 'a1',
        version: 1,
        source: DangerAlertDeliverySource.fcm,
      ));
      expect(decision, AlertVersionDecision.suppressDuplicate);
    });

    test('accepts higher version as update only', () async {
      await tracker.record(_payload(alertId: 'a1', version: 1));
      final decision = await tracker.evaluate(_payload(
        alertId: 'a1',
        version: 2,
        state: DangerAlertLifecycleState.escalated,
      ));
      expect(decision, AlertVersionDecision.acceptUpdateOnly);
    });

    test('suppresses stale version after cleared', () async {
      await tracker.record(_payload(
        alertId: 'a1',
        version: 3,
        state: DangerAlertLifecycleState.cleared,
      ));
      final decision = await tracker.evaluate(_payload(alertId: 'a1', version: 1));
      expect(decision, AlertVersionDecision.suppressAfterCleared);
    });

    test('suppresses out-of-order older version', () async {
      await tracker.record(_payload(alertId: 'a1', version: 3));
      final decision = await tracker.evaluate(_payload(alertId: 'a1', version: 2));
      expect(decision, AlertVersionDecision.suppressOldVersion);
    });
  });
}
