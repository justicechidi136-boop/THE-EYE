import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/alerts/danger_alert_models.dart';
import 'package:the_eye_watch/services/quiet_hours_service.dart';

void main() {
  group('QuietHoursService', () {
    final service = QuietHoursService();

    test('allows speech outside quiet window', () {
      final evaluation = service.evaluate(
        preferences: const WatchAccessibilityPreferences(
          quietHoursStart: '22:00',
          quietHoursEnd: '06:00',
        ),
        priority: DangerAlertPriority.medium,
        now: DateTime(2026, 7, 30, 12, 0),
      );
      expect(evaluation.inQuietHours, isFalse);
      expect(evaluation.allowSpeech, isTrue);
    });

    test('suppresses medium alert speech during quiet hours', () {
      final evaluation = service.evaluate(
        preferences: const WatchAccessibilityPreferences(
          quietHoursStart: '22:00',
          quietHoursEnd: '06:00',
        ),
        priority: DangerAlertPriority.medium,
        now: DateTime(2026, 7, 30, 23, 30),
      );
      expect(evaluation.inQuietHours, isTrue);
      expect(evaluation.allowSpeech, isFalse);
      expect(evaluation.allowStrongVibration, isFalse);
    });

    test('critical override bypasses quiet hours when enabled', () {
      final evaluation = service.evaluate(
        preferences: const WatchAccessibilityPreferences(
          quietHoursStart: '22:00',
          quietHoursEnd: '06:00',
          allowCriticalAlertDuringQuietHours: true,
        ),
        priority: DangerAlertPriority.critical,
        now: DateTime(2026, 7, 30, 1, 0),
      );
      expect(evaluation.inQuietHours, isTrue);
      expect(evaluation.allowSpeech, isTrue);
      expect(evaluation.allowStrongVibration, isTrue);
    });

    test('cross-midnight quiet window is detected', () {
      final evaluation = service.evaluate(
        preferences: const WatchAccessibilityPreferences(
          quietHoursStart: '22:00',
          quietHoursEnd: '06:00',
        ),
        priority: DangerAlertPriority.high,
        now: DateTime(2026, 7, 30, 3, 0),
      );
      expect(evaluation.inQuietHours, isTrue);
    });
  });
}
