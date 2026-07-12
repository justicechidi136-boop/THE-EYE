import 'package:flutter/services.dart';

/// Vibration hooks for SOS hold, countdown, and confirmation.
class VibrationService {
  VibrationService({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel('com.theeye.watch/vibration');

  final MethodChannel _channel;
  bool _enabled = true;

  void setEnabled(bool enabled) => _enabled = enabled;

  Future<void> pulse() async {
    if (!_enabled) return;
    try {
      await _channel.invokeMethod<void>('pulse');
    } catch (_) {
      await HapticFeedback.mediumImpact();
    }
  }

  Future<void> confirmSos() async {
    if (!_enabled) return;
    try {
      await _channel.invokeMethod<void>('confirmSos');
    } catch (_) {
      await HapticFeedback.heavyImpact();
    }
  }

  Future<void> cancelPattern() async {
    if (!_enabled) return;
    try {
      await _channel.invokeMethod<void>('cancel');
    } catch (_) {
      await HapticFeedback.selectionClick();
    }
  }
}
