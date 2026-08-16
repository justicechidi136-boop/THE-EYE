import 'dart:async';

import 'package:flutter/foundation.dart';

import '../alerts/danger_alert_models.dart';
import '../alerts/danger_alert_templates.dart';
import '../models/watch_safety_status.dart';
import '../services/alert_version_tracker.dart';
import '../services/audio_output_service.dart';
import '../services/danger_alert_signature_verifier.dart';
import '../services/quiet_hours_service.dart';
import 'danger_alert_tts_service.dart';
import 'tts_contract.dart';
import 'vibration_service.dart';

typedef DangerAlertNavigateHandler = Future<void> Function(
    DangerAlertPayload payload);

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
  signatureRejected,
}

typedef DangerAlertTelemetryHandler = void Function(
  DangerAlertTelemetryEvent event, {
  String? alertId,
  String? reason,
});

typedef DangerAlertFeatureFlagChecker = bool Function(String flag,
    {bool fallback});

class DangerAlertCoordinator {
  DangerAlertCoordinator({
    required VibrationService vibration,
    AlertVersionTracker? versionTracker,
    QuietHoursService? quietHours,
    AudioOutputService? audioOutput,
    DangerAlertTtsService? tts,
    DangerAlertSignatureVerifier? signatureVerifier,
    DangerAlertNavigateHandler? onNavigate,
    DangerAlertTelemetryHandler? onTelemetry,
    DangerAlertFeatureFlagChecker? isFeatureEnabled,
    bool requireSignature = true,
  })  : _vibration = vibration,
        _versionTracker = versionTracker,
        _quietHours = quietHours ?? QuietHoursService(),
        _audioOutput = audioOutput ?? AudioOutputService(),
        _tts = tts ?? DangerAlertTtsService(),
        _signatureVerifier =
            signatureVerifier ?? DangerAlertSignatureVerifier(),
        _onNavigate = onNavigate,
        _onTelemetry = onTelemetry,
        _isFeatureEnabled = isFeatureEnabled,
        _requireSignature = requireSignature;

  final VibrationService _vibration;
  final AlertVersionTracker? _versionTracker;
  final QuietHoursService _quietHours;
  final AudioOutputService _audioOutput;
  final DangerAlertTtsService _tts;
  final DangerAlertSignatureVerifier _signatureVerifier;
  DangerAlertNavigateHandler? _onNavigate;
  final DangerAlertTelemetryHandler? _onTelemetry;
  final DangerAlertFeatureFlagChecker? _isFeatureEnabled;
  final bool _requireSignature;

  WatchAccessibilityPreferences _preferences =
      const WatchAccessibilityPreferences();

  DangerAlertPayload? _activePayload;
  final ValueNotifier<WatchSafetyStatus> safetyStatus =
      ValueNotifier<WatchSafetyStatus>(WatchSafetyStatus.safe);
  Timer? _repeatTimer;
  int _repeatIndex = 0;
  bool _muted = false;

  WatchAccessibilityPreferences get preferences => _preferences;
  DangerAlertTtsService get tts => _tts;

  set onNavigate(DangerAlertNavigateHandler? handler) => _onNavigate = handler;

  void updatePreferences(WatchAccessibilityPreferences preferences) {
    _preferences = preferences;
  }

  void restoreSafetyStatus(WatchSafetyStatus status) {
    safetyStatus.value = status;
  }

  Future<void> dispose() async {
    _repeatTimer?.cancel();
    safetyStatus.dispose();
    await _tts.stop();
  }

  Future<void> handleIncoming(DangerAlertPayload payload) async {
    _emit(DangerAlertTelemetryEvent.received, alertId: payload.alertId);

    if (payload.isExpired) {
      safetyStatus.value = WatchSafetyStatus.safe;
      _emit(DangerAlertTelemetryEvent.expired, alertId: payload.alertId);
      return;
    }

    if (_requireSignature) {
      final verifyResult = await _signatureVerifier.verify(payload);
      if (!verifyResult.valid) {
        _emit(
          DangerAlertTelemetryEvent.signatureRejected,
          alertId: payload.alertId,
          reason: verifyResult.reason,
        );
        return;
      }
    }

    final decision = _versionTracker == null
        ? AlertVersionDecision.acceptFull
        : await _versionTracker.evaluate(payload);

    switch (decision) {
      case AlertVersionDecision.suppressDuplicate:
      case AlertVersionDecision.suppressOldVersion:
      case AlertVersionDecision.suppressAfterCleared:
      case AlertVersionDecision.suppressAcknowledged:
        _emit(
          DangerAlertTelemetryEvent.duplicateSuppressed,
          alertId: payload.alertId,
          reason: decision.name,
        );
        return;
      case AlertVersionDecision.acceptUpdateOnly:
        await _applyUpdate(payload);
        return;
      case AlertVersionDecision.acceptFull:
        break;
    }

    if (payload.isCleared) {
      await clearActive(cleared: true);
      await _versionTracker?.record(payload);
      await _onNavigate?.call(payload);
      return;
    }

    _activePayload = payload;
    safetyStatus.value = WatchSafetyStatus.fromTrustedPayload(payload);
    _repeatIndex = 0;
    _muted = false;
    await _versionTracker?.record(payload);
    await _present(payload, vibrate: true, speak: true);
    await _onNavigate?.call(payload);
  }

  Future<void> _applyUpdate(DangerAlertPayload payload) async {
    _activePayload = payload;
    safetyStatus.value = WatchSafetyStatus.fromTrustedPayload(payload);
    _repeatIndex = 0;
    await _versionTracker?.record(payload);
    final vibrate = payload.isEscalation;
    await _present(payload, vibrate: vibrate, speak: true);
    await _onNavigate?.call(payload);
  }

  Future<void> acknowledgeActive() async {
    _repeatTimer?.cancel();
    await _tts.stop();
    final payload = _activePayload;
    if (payload != null) {
      await _versionTracker?.markAcknowledged(payload);
    }
    _activePayload = null;
    safetyStatus.value = WatchSafetyStatus.safe;
    _emit(DangerAlertTelemetryEvent.acknowledged, alertId: payload?.alertId);
  }

  Future<void> muteActive() async {
    _muted = true;
    _repeatTimer?.cancel();
    await _tts.stop();
    _emit(DangerAlertTelemetryEvent.muted, alertId: _activePayload?.alertId);
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
    safetyStatus.value = WatchSafetyStatus.safe;
  }

  Future<void> _present(
    DangerAlertPayload payload, {
    required bool vibrate,
    required bool speak,
  }) async {
    _emit(DangerAlertTelemetryEvent.displayed, alertId: payload.alertId);
    final quietHoursEnabled =
        _isFeatureEnabled?.call('WATCH_QUIET_HOURS', fallback: true) ?? true;
    final quiet = quietHoursEnabled
        ? _quietHours.evaluate(
            preferences: _preferences,
            priority: payload.priority,
          )
        : QuietHoursEvaluation(
            inQuietHours: false,
            allowSpeech: true,
            allowStrongVibration: true,
          );
    if (vibrate) {
      if (quiet.inQuietHours && !quiet.allowStrongVibration) {
        await _vibration.playPattern(VibrationPattern.medium);
      } else {
        await _vibrate(payload);
      }
    }
    if (speak && !_muted) {
      if (!(_isFeatureEnabled?.call('WATCH_LOCAL_TTS', fallback: true) ??
          true)) {
        _emit(DangerAlertTelemetryEvent.ttsUnavailable,
            alertId: payload.alertId, reason: 'local_tts_disabled');
        return;
      }
      await _speak(payload, quietHours: quiet);
      _scheduleRepeats(payload, quietHours: quiet);
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

  Future<void> _speak(
    DangerAlertPayload payload, {
    bool force = false,
    QuietHoursEvaluation? quietHours,
  }) async {
    if (_muted) return;

    final quiet = quietHours ??
        _quietHours.evaluate(
            preferences: _preferences, priority: payload.priority);
    if (!force && !quiet.allowSpeech) return;

    final language =
        payload.languageHint ?? _preferences.preferredSpokenLanguage;
    final speechText = DangerAlertTemplates.resolve(
      alertCode: payload.alertCode,
      languageCode: language,
      params: (
        areaName: payload.areaName,
        distanceMeters: payload.distanceMeters
      ),
    );

    if (!force && !await _shouldSpeak(payload)) return;

    _emit(DangerAlertTelemetryEvent.speechStarted, alertId: payload.alertId);
    final outcome = await _tts.speak(
      text: speechText,
      preferences: _preferences,
      dedupeKey: force ? '${payload.dedupeKey}:replay' : payload.dedupeKey,
      languageHint: language,
      priority: payload.priority == DangerAlertPriority.critical
          ? TtsPriority.critical
          : TtsPriority.high,
      contentId: payload.alertId,
    );

    switch (outcome) {
      case DangerAlertTtsOutcome.unavailable:
        _emit(DangerAlertTelemetryEvent.ttsUnavailable,
            alertId: payload.alertId);
      case DangerAlertTtsOutcome.fallbackLanguage:
        _emit(DangerAlertTelemetryEvent.fallbackLanguage,
            alertId: payload.alertId);
      case DangerAlertTtsOutcome.completed:
      case DangerAlertTtsOutcome.started:
        _emit(DangerAlertTelemetryEvent.speechCompleted,
            alertId: payload.alertId);
      case DangerAlertTtsOutcome.skipped:
        break;
    }
  }

  Future<bool> _shouldSpeak(DangerAlertPayload payload) async {
    if (!_preferences.spokenDangerAlertsEnabled) return false;

    final headphonePrivacyEnabled =
        _isFeatureEnabled?.call('WATCH_HEADPHONE_PRIVACY', fallback: true) ??
            true;
    if (!headphonePrivacyEnabled) return true;

    final headphones = await _audioOutput.isHeadphoneConnected();
    if (!_preferences.speakSensitiveAlertsAloud) {
      if (headphones && _preferences.speakOverHeadphones) return true;
      if (payload.priority == DangerAlertPriority.critical &&
          _preferences.allowCriticalAlertDuringQuietHours) {
        return headphones;
      }
      return false;
    }
    return true;
  }

  void _scheduleRepeats(
    DangerAlertPayload payload, {
    QuietHoursEvaluation? quietHours,
  }) {
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
        if (_activePayload?.alertId != payload.alertId || _muted) {
          timer.cancel();
          return;
        }
        _repeatIndex += 1;
        if (_repeatIndex >= maxRepeats) {
          timer.cancel();
          return;
        }
        await _speak(payload, force: true, quietHours: quietHours);
        if (quietHours?.allowStrongVibration ?? true) {
          await _vibrate(payload);
        }
      },
    );
  }

  void _emit(DangerAlertTelemetryEvent event,
      {String? alertId, String? reason}) {
    _onTelemetry?.call(event, alertId: alertId, reason: reason);
  }
}
