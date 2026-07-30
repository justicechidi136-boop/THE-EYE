import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/alerts/danger_alert_models.dart';
import 'package:the_eye_watch/alerts/danger_alert_templates.dart';

void main() {
  group('DangerAlertTemplates', () {
    test('resolves English armed robbery template', () {
      final text = DangerAlertTemplates.resolve(
        alertCode: DangerAlertCodes.armedRobberyNearby,
        languageCode: SpokenLanguageCodes.english,
        params: (areaName: 'Ikeja', distanceMeters: 850),
      );
      expect(text, contains('armed robbery'));
      expect(text, contains('Ikeja'));
      expect(text, contains('850 metres'));
    });

    test('resolves Nigerian Pidgin armed robbery template', () {
      final text = DangerAlertTemplates.resolve(
        alertCode: DangerAlertCodes.armedRobberyNearby,
        languageCode: SpokenLanguageCodes.nigerianPidgin,
        params: (areaName: 'Ikeja', distanceMeters: 850),
      );
      expect(text.toLowerCase(), contains('armed robbery'));
      expect(text, contains('Ikeja'));
    });

    test('falls back to English for unsupported language pack', () {
      final text = DangerAlertTemplates.resolve(
        alertCode: DangerAlertCodes.fireNearby,
        languageCode: SpokenLanguageCodes.hausa,
        params: (areaName: 'Kano', distanceMeters: 500),
      );
      expect(text.toLowerCase(), contains('fire'));
    });
  });

  group('DangerAlertPayload', () {
    test('parses trusted FCM payload', () {
      final payload = DangerAlertPayload.fromFcmData({
        'dangerAlertCode': DangerAlertCodes.kidnappingNearby,
        'dangerAlertPriority': 'CRITICAL',
        'incidentId': 'inc-1',
        'zoneId': 'zone-1',
        'safetyAlertId': 'alert-1',
        'distanceMeters': '500',
        'areaName': 'Ikeja',
        'languageHint': SpokenLanguageCodes.nigerianPidgin,
        'issuedAt': DateTime.now().toIso8601String(),
        'acknowledgementRequired': 'true',
        'repeatCount': '3',
      });

      expect(payload.alertCode, DangerAlertCodes.kidnappingNearby);
      expect(payload.priority, DangerAlertPriority.critical);
      expect(payload.distanceMeters, 500);
    });

    test('rejects untrusted alert codes', () {
      expect(
        () => DangerAlertPayload.fromFcmData({
          'dangerAlertCode': 'SPEAK_ARBITRARY_TEXT',
        }),
        throwsFormatException,
      );
    });

    test('ignores expired payloads', () {
      final payload = parseDangerAlertPayload({
        'dangerAlertCode': DangerAlertCodes.generalEntry,
        'dangerAlertPriority': 'HIGH',
        'incidentId': 'inc-1',
        'zoneId': 'zone-1',
        'safetyAlertId': 'alert-1',
        'issuedAt': DateTime.now().subtract(const Duration(hours: 2)).toIso8601String(),
        'expiresAt': DateTime.now().subtract(const Duration(hours: 1)).toIso8601String(),
      });
      expect(payload, isNull);
    });
  });
}
