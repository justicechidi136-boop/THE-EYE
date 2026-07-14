import 'dart:async';

import 'package:geolocator/geolocator.dart';

import '../api/watch_api_client.dart';
import '../api/watch_api_paths.dart';
import '../models/connectivity_mode.dart';
import '../storage/secure_credential_store.dart';
import 'connectivity_service.dart';

class LocationService {
  LocationService({
    required WatchApiClient api,
    required SecureCredentialStore credentials,
    required ConnectivityService connectivity,
    GeolocatorPlatform? geolocator,
    Future<Position?> Function()? positionProvider,
  })  : _api = api,
        _credentials = credentials,
        _connectivity = connectivity,
        _geolocator = geolocator ?? GeolocatorPlatform.instance,
        _positionProvider = positionProvider;

  final WatchApiClient _api;
  final SecureCredentialStore _credentials;
  final ConnectivityService _connectivity;
  final GeolocatorPlatform _geolocator;
  final Future<Position?> Function()? _positionProvider;

  Timer? _trackingTimer;
  bool _emergencyActive = false;

  static const emergencyInterval = Duration(seconds: 5);
  static const idleInterval = Duration(seconds: 60);

  Future<Position?> getCurrentPosition() async {
    if (_positionProvider != null) {
      return _positionProvider();
    }
    try {
      if (!await _ensurePermission()) return null;
      return _geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
    } catch (_) {
      return null;
    }
  }

  Future<bool> requestPermission() => _ensurePermission();

  Future<bool> _ensurePermission() async {
    final permission = await _geolocator.checkPermission();
    if (permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse) {
      return true;
    }
    if (permission == LocationPermission.deniedForever) {
      return false;
    }
    final requested = await _geolocator.requestPermission();
    return requested == LocationPermission.always ||
        requested == LocationPermission.whileInUse;
  }

  void startEmergencyTracking({String? sosEventId}) {
    _emergencyActive = true;
    _restartTimer(sosEventId: sosEventId, interval: emergencyInterval);
  }

  void startIdleTracking() {
    _emergencyActive = false;
    _restartTimer(interval: idleInterval);
  }

  void stopTracking() {
    _trackingTimer?.cancel();
    _trackingTimer = null;
    _emergencyActive = false;
  }

  void _restartTimer({String? sosEventId, required Duration interval}) {
    _trackingTimer?.cancel();
    _trackingTimer = Timer.periodic(interval, (_) {
      unawaited(_sendGpsTick(sosEventId: sosEventId));
    });
  }

  Future<void> _sendGpsTick({String? sosEventId}) async {
    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    if (deviceId == null || deviceSecret == null) return;

    final position = await getCurrentPosition();
    if (position == null) return;

    if (_connectivity.activeMode == WatchConnectivityMode.offline) return;

    await _api.post(
      WatchApiPaths.gps(deviceId),
      body: {
        'deviceId': deviceId,
        'deviceSecret': deviceSecret,
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
        'speed': position.speed,
        'heading': position.heading,
        'altitude': position.altitude,
        'capturedAt': DateTime.now().toUtc().toIso8601String(),
        'sourceMode': _connectivity.activeMode.apiValue,
        if (sosEventId != null) 'sosEventId': sosEventId,
      },
    );
  }

  bool get isEmergencyActive => _emergencyActive;
}
