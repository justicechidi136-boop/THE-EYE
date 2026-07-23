import 'package:flutter/services.dart';

/// Bridges to Android [EmergencyTrackingService] for Target B full-Android watches.
/// On Wear OS the native layer persists state without forcing a foreground service.
class EmergencyForegroundService {
  EmergencyForegroundService({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel('com.theeye.watch/emergency');

  final MethodChannel _channel;
  bool _active = false;

  bool get isActive => _active;

  Future<bool> isWearOs() async {
    try {
      final value = await _channel.invokeMethod<bool>('isWearOs');
      return value ?? false;
    } catch (_) {
      return false;
    }
  }

  Future<bool> restoreAfterBoot() async {
    try {
      final restored = await _channel.invokeMethod<bool>('restore');
      _active = restored ?? false;
      return _active;
    } catch (_) {
      return false;
    }
  }

  Future<void> start({
    String? sosEventId,
    String? incidentId,
    bool silent = false,
  }) async {
    if (_active) return;
    try {
      await _channel.invokeMethod<void>('start', {
        'authorized': true,
        'sosEventId': sosEventId,
        'incidentId': incidentId,
        'silent': silent,
      });
    } catch (_) {
      // Tests / unsupported targets continue with in-process tracking only.
    }
    _active = true;
  }

  Future<void> stop() async {
    try {
      await _channel.invokeMethod<void>('stop');
    } catch (_) {}
    _active = false;
  }

  /// Test-only hook to simulate active state without platform channel.
  void debugSetActive(bool value) => _active = value;
}
