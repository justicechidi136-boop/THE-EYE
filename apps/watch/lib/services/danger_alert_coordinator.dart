import 'dart:async';

import '../alerts/danger_alert_models.dart';
import '../alerts/danger_alert_templates.dart';
import 'danger_alert_tts_service.dart';
import 'vibration_service.dart';

typedef DangerAlertNavigateHandler = Future<void> Function(DangerAlertPayload payload);

enum DangerAlertTelemetryEvent {
  received,
  displayed,
  speechStarted,
  speechCompleted,
  ttsUnavailable,
  fallbackLanguage,
  acknowledged,
  muted,
  expired,
  duplicateSuppressed,
}

typedef DangerAlertTelemetryHandler = void Function(
  DangerAlertTelemetryEvent event, {
  String? alertId,
  String? reason,
});

class DangerAlertCoordinator {
  DangerAlertCoordinator({
    required VibrationService vibration,
    DangerAlertTtsService? tts,
    DangerAlertNavigateHandler? onNavigate,
    DangerAlertTelemetryHandler? onTelemetry,
  })  : _vibration = vibration,
        _tts = tts ?? DangerAlertTtsService(),
        _onNavigate = onNavigate,
        _onTelemetry = onTelemetry;

  final VibrationService _vibration;
  final DangerAlertTtsService _tts;
  DangerAlertNavigateHandler? _onNavigate;
  final DangerAlertTelemetryHandler? _onTelemetry;

  WatchAccessibilityPreferences _preferences =
      const WatchAccessibilityPreferences();

  DangerAlertPayload? _activePayload;
  Timer? _repeatTimer;
  int _repeatIndex = 0;
  final Set<String> _handledKeys = <String>{};
  bool _muted = false;

  WatchAccessibilityPreferences get preferences => _preferences;
  DangerAlertTtsService get tts => _tts;

  set onNavigate(DangerAlertNavigateHandler? handler) => _onNavigate = handler;

  void updatePreferences(WatchAccessibilityPreferences preferences) {
    _preferences = preferences;
  }

  Future<void> dispose() async {
    _repeatTimer?.cancel();
    await _tts.dispose();
  }

  Future<void> handleIncoming(DangerAlertPayload payload) async {
    _emit(DangerAlertTelemetryEvent.received, alertId: payload.safetyAlertId);

    if (payload.isExpired) {
      _emit(DangerAlertTelemetryEvent.expired, alertId: payload.safetyAlertId);
      return;
    }

    if (_handledKeys.contains(payload.dedupeKey)) {
      _emit(
        DangerAlertTelemetryEvent.duplicateSuppressed,
        alertId: payload.safetyAlertId,
      );
      return;
    }

    if (_activePayload != null &&
        _severityRank(payload.priority) <=
            _severityRank(_activePayload!.priority)) {
      _emit(
        DangerAlertTelemetryEvent.duplicateSuppressed,
        alertId: payload.safetyAlertId,
        reason: 'lower_priority',
      );
      return;
    }

    _handledKeys.add(payload.dedupeKey);
    _activePayload = payload;
    _repeatIndex = 0;
    _muted = false;

    await _present(payload);
    await _onNavigate?.call(payload);
  }

  Future<void> acknowledgeActive() async {
    _repeatTimer?.cancel();
    await _tts.stop();
    _activePayload = null;
    _emit(DangerAlertTelemetryEvent.acknowledged);
  }

  Future<void> muteActive() async {
    _muted = true;
    _repeatTimer?.cancel();
    await _tts.stop();
    _emit(DangerAlertTelemetryEvent.muted);
  }

  Future<void> replayActive() async {
    final payload = _activePayload;
    if (payload == null || _muted) return;
    await _speak(payload, force: true);
  }

  Future<void> clearActive({bool cleared = false}) async {
    _repeatTimer?.cancel();
    await _tts.stop();
    if (cleared) {
      await _vibration.playPattern(VibrationPattern.clear);
    }
    _activePayload = null;
  }

  Future<void> _present(DangerAlertPayload payload) async {
    _emit(DangerAlertTelemetryEvent.displayed, alertId: payload.safetyAlertId);
    await _vibrate(payload);
    if (!_muted) {
      await _speak(payload);
      _scheduleRepeats(payload);
    }
  }

  Future<void> _vibrate(DangerAlertPayload payload) async {
    final pattern = switch (payload.priority) {
      DangerAlertPriority.critical => VibrationPattern.critical,
      DangerAlertPriority.high => VibrationPattern.high,
      DangerAlertPriority.medium => VibrationPattern.medium,
      DangerAlertPriority.low => VibrationPattern.clear,
    };

    if (_preferences.vibrationStrength == VibrationStrength.reduced &&
        pattern == VibrationPattern.critical) {
      await _vibration.playPattern(VibrationPattern.high);
      return;
    }

    await _vibration.playPattern(pattern);
  }

  Future<void> _speak(DangerAlertPayload payload, {bool force = false}) async {
    if (_muted) return;

    final language = payload.languageHint ?? _preferences.preferredSpokenLanguage;
    final speechText = DangerAlertTemplates.resolve(
      alertCode: payload.alertCode,
      languageCode: language,
      params: (areaName: payload.areaName, distanceMeters: payload.distanceMeters),
    );

    if (!force && !_shouldSpeak(payload)) return;

    _emit(DangerAlertTelemetryEvent.speechStarted, alertId: payload.safetyAlertId);
    final outcome = await _tts.speak(
      text: speechText,
      preferences: _preferences,
      dedupeKey: force ? '${payload.dedupeKey}:replay' : payload.dedupeKey,
      languageHint: language,
    );

    switch (outcome) {
      case DangerAlertTtsOutcome.unavailable:
        _emit(DangerAlertTelemetryEvent.ttsUnavailable, alertId: payload.safetyAlertId);
      case DangerAlertTtsOutcome.fallbackLanguage:
        _emit(DangerAlertTelemetryEvent.fallbackLanguage, alertId: payload.safetyAlertId);
      case DangerAlertTtsOutcome.completed:
      case DangerAlertTtsOutcome.started:
        _emit(DangerAlertTelemetryEvent.speechCompleted, alertId: payload.safetyAlertId);
      case DangerAlertTtsOutcome.skipped:
        break;
    }
  }

  bool _shouldSpeak(DangerAlertPayload payload) {
    if (! _preferences.spokenDangerAlertsEnabled) return false;
    if (!_preferences.speakSensitiveAlertsAloud && payload.priority == DangerAlertPriority.critical) {
      return false;
    }
    return true;
  }

  void _scheduleRepeats(DangerAlertPayload payload) {
    _repeatTimer?.cancel();
    final maxRepeats = payload.allClear
        ? 1
        : (_preferences.repeatCount > 0
            ? _preferences.repeatCount
            : payload.repeatCount);

    if (maxRepeats <= 1) return;

    _repeatTimer = Timer.periodic(
      Duration(seconds: _preferences.repeatIntervalSeconds),
      (timer) async {
        if (_activePayload?.safetyAlertId != payload.safetyAlertId || _muted) {
          timer.cancel();
          return;
        }
        _repeatIndex += 1;
        if (_repeatIndex >= maxRepeats) {
          timer.cancel();
          return;
        }
        await _speak(payload, force: true);
        await _vibrate(payload);
      },
    );
  }

  int _severityRank(DangerAlertPriority priority) => switch (priority) {
        DangerAlertPriority.critical => 4,
        DangerAlertPriority.high => 3,
        DangerAlertPriority.medium => 2,
        DangerAlertPriority.low => 1,
      };

  void _emit(DangerAlertTelemetryEvent event, {String? alertId, String? reason}) {
    _onTelemetry?.call(event, alertId: alertId, reason: reason);
  }
}
