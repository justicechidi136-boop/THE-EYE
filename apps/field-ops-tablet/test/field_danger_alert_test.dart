import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_field_ops/danger_alerts/field_danger_alert.dart';

void main() {
  test('parses trusted active alert without exact reporter location', () {
    final alert = FieldDangerAlert.fromData({
      'type': 'NearbyDangerWarning',
      'alertId': 'danger:event-1:field-1',
      'alertVersion': '2',
      'alertLifecycleState': 'ACTIVE',
      'dangerAlertCode': 'DANGER_ZONE_ARMED_ROBBERY_NEARBY',
      'zoneId': 'event-1',
      'areaName': 'Airport Road',
      'distanceMeters': '1400',
      'issuedAt': DateTime.now().toUtc().toIso8601String(),
      'expiresAt':
          DateTime.now()
              .add(const Duration(minutes: 20))
              .toUtc()
              .toIso8601String(),
    });

    expect(alert, isNotNull);
    expect(alert!.dangerType, 'ACTIVE ROBBERY');
    expect(alert.area, 'Airport Road');
    expect(
      alert.speech,
      'Danger alert. ACTIVE ROBBERY reported in Airport Road.',
    );
    expect(alert.dedupeKey, 'danger:event-1:field-1:2');
  });

  test('rejects untrusted and stale alert payloads', () {
    expect(FieldDangerAlert.fromData({'type': 'NearbyDangerWarning'}), isNull);
    expect(
      FieldDangerAlert.fromData({
        'type': 'NearbyDangerWarning',
        'alertId': 'danger-1',
        'dangerAlertCode': 'DANGER_ZONE_FIRE_NEARBY',
        'zoneId': 'event-1',
        'issuedAt': DateTime.now().toUtc().toIso8601String(),
        'expiresAt':
            DateTime.now()
                .subtract(const Duration(minutes: 1))
                .toUtc()
                .toIso8601String(),
      }),
      isNull,
    );
  });
}
