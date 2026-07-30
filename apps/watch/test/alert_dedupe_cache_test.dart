import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:the_eye_watch/alerts/danger_alert_models.dart';
import 'package:the_eye_watch/services/alert_dedupe_cache.dart';
import 'package:the_eye_watch/storage/secure_credential_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AlertDedupeCache', () {
    late PreferencesStore preferences;
    late AlertDedupeCache cache;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      preferences = PreferencesStore();
      cache = AlertDedupeCache(preferences: preferences);
    });

    test('suppresses duplicate FCM after phone relay handled alert', () async {
      const alertId = 'alert-1:Critical';
      await cache.record(
        deterministicAlertId: alertId,
        source: DangerAlertDeliverySource.phoneRelay,
      );

      final suppress = await cache.shouldSuppress(
        deterministicAlertId: alertId,
        incomingSource: DangerAlertDeliverySource.fcm,
      );
      expect(suppress, isTrue);
    });

    test('does not suppress first delivery', () async {
      final suppress = await cache.shouldSuppress(
        deterministicAlertId: 'alert-2:Critical',
        incomingSource: DangerAlertDeliverySource.fcm,
      );
      expect(suppress, isFalse);
    });

    test('acknowledged alerts stay suppressed', () async {
      const alertId = 'alert-3:Critical';
      await cache.record(
        deterministicAlertId: alertId,
        source: DangerAlertDeliverySource.fcm,
      );
      await cache.markAcknowledged(alertId);

      final suppress = await cache.shouldSuppress(
        deterministicAlertId: alertId,
        incomingSource: DangerAlertDeliverySource.phoneRelay,
      );
      expect(suppress, isTrue);
    });
  });
}
