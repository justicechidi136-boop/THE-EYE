import 'dart:async';

import 'package:battery_plus/battery_plus.dart';

import '../api/watch_api_client.dart';
import '../api/watch_api_paths.dart';
import '../models/device_status.dart';
import '../storage/secure_credential_store.dart';
import 'connectivity_service.dart';

class HeartbeatService {
  HeartbeatService({
    required WatchApiClient api,
    required SecureCredentialStore credentials,
    required ConnectivityService connectivity,
    this.normalInterval = const Duration(minutes: 5),
    this.emergencyInterval = const Duration(minutes: 2),
  })  : _api = api,
        _credentials = credentials,
        _connectivity = connectivity;

  final WatchApiClient _api;
  final SecureCredentialStore _credentials;
  final ConnectivityService _connectivity;

  final Duration normalInterval;
  final Duration emergencyInterval;

  Timer? _timer;
  DeviceStatusSnapshot? _latest;
  final Battery _battery = Battery();

  DeviceStatusSnapshot? get latest => _latest;

  void start({bool emergency = false}) {
    _timer?.cancel();
    final interval = emergency ? emergencyInterval : normalInterval;
    _timer = Timer.periodic(interval, (_) => unawaited(sendHeartbeat()));
    unawaited(sendHeartbeat());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  Future<DeviceStatusSnapshot?> sendHeartbeat({
    int? batteryLevel,
    int signalStrength = 80,
    String firmwareVersion = '0.1.0',
  }) async {
    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    if (deviceId == null || deviceSecret == null) return null;

    var resolvedBattery = batteryLevel ?? 100;
    try {
      final level = await _battery.batteryLevel;
      if (level >= 0 && level <= 100) resolvedBattery = level;
    } catch (_) {
      // Keep caller/default fallback when platform battery API is unavailable.
    }

    await _api.post(
      WatchApiPaths.heartbeat(deviceId),
      body: {
        'deviceId': deviceId,
        'deviceSecret': deviceSecret,
        'connectivityMode': _connectivity.activeMode.apiValue,
        'pairedPhoneAvailable': _connectivity.pairedPhoneAvailable,
        'internetAvailable': _connectivity.internetAvailable,
        'batteryLevel': resolvedBattery,
        'signalStrength': signalStrength,
        'firmwareVersion': firmwareVersion,
      },
    );

    _latest = DeviceStatusSnapshot(
      deviceId: deviceId,
      batteryLevel: resolvedBattery,
      signalStrength: signalStrength,
      connectivityMode: _connectivity.activeMode,
      isOnline: true,
      firmwareVersion: firmwareVersion,
      lastSeenAt: DateTime.now(),
      pairedPhoneAvailable: _connectivity.pairedPhoneAvailable,
      internetAvailable: _connectivity.internetAvailable,
      failoverEnabled: _connectivity.failoverEnabled,
    );
    return _latest;
  }
}
