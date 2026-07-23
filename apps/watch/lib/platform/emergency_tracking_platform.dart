import 'package:flutter/services.dart';

class EmergencyTrackingPlatform {
  EmergencyTrackingPlatform({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel('com.theeye.watch/emergency_tracking');

  final MethodChannel _channel;

  Future<void> startEmergencyTracking({
    String? sosEventId,
    bool silent = false,
  }) async {
    try {
      await _channel.invokeMethod<void>('startEmergencyTracking', {
        'sosEventId': sosEventId,
        'silent': silent,
      });
    } catch (_) {
      // Native service unavailable on emulator or older builds — Dart timer still runs.
    }
  }

  Future<void> stopEmergencyTracking() async {
    try {
      await _channel.invokeMethod<void>('stopEmergencyTracking');
    } catch (_) {
      // Ignore when native bridge is unavailable.
    }
  }
}
