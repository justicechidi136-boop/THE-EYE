import '../alerts/danger_alert_models.dart';

class QuietHoursEvaluation {
  const QuietHoursEvaluation({
    required this.inQuietHours,
    required this.allowSpeech,
    required this.allowStrongVibration,
    this.reason,
  });

  final bool inQuietHours;
  final bool allowSpeech;
  final bool allowStrongVibration;
  final String? reason;
}

class QuietHoursService {
  QuietHoursEvaluation evaluate({
    required WatchAccessibilityPreferences preferences,
    required DangerAlertPriority priority,
    DateTime? now,
    String timeZoneId = 'Africa/Lagos',
  }) {
    final current = now ?? DateTime.now();
    final start = _parseHour(preferences.quietHoursStart);
    final end = _parseHour(preferences.quietHoursEnd);
    if (start == null || end == null) {
      return const QuietHoursEvaluation(
        inQuietHours: false,
        allowSpeech: true,
        allowStrongVibration: true,
      );
    }

    final minutes = current.hour * 60 + current.minute;
    final inQuiet = _isWithinQuietWindow(minutes, start, end);
    if (!inQuiet) {
      return const QuietHoursEvaluation(
        inQuietHours: false,
        allowSpeech: true,
        allowStrongVibration: true,
      );
    }

    final critical = priority == DangerAlertPriority.critical;
    final bypass = critical && preferences.allowCriticalAlertDuringQuietHours;
    return QuietHoursEvaluation(
      inQuietHours: true,
      allowSpeech: bypass,
      allowStrongVibration: bypass,
      reason: bypass ? 'critical_override' : 'quiet_hours',
    );
  }

  int? _parseHour(String? value) {
    if (value == null || !value.contains(':')) return null;
    final parts = value.split(':');
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) return null;
    return hour * 60 + minute;
  }

  bool _isWithinQuietWindow(int currentMinutes, int startMinutes, int endMinutes) {
    if (startMinutes == endMinutes) return false;
    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}
