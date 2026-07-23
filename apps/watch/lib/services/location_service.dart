import 'dart:async';

import 'package:geolocator/geolocator.dart';

import '../api/watch_api_client.dart';
import '../api/watch_api_paths.dart';
import '../location/location_permission_service.dart';
import '../models/connectivity_mode.dart';
import '../models/offline_event.dart';
import '../platform/emergency_tracking_platform.dart';
import '../storage/secure_credential_store.dart';
import 'connectivity_service.dart';

class LocationService {
  LocationService({
    required WatchApiClient api,
    required SecureCredentialStore credentials,
    required PreferencesStore preferences,
    required ConnectivityService connectivity,
    GeolocatorPlatform? geolocator,
    Future<Position?> Function()? positionProvider,
    EmergencyTrackingPlatform? trackingPlatform,
  })  : _api = api,
        _credentials = credentials,
        _preferences = preferences,
        _connectivity = connectivity,
        _geolocator = geolocator ?? GeolocatorPlatform.instance,
        _positionProvider = positionProvider,
        _trackingPlatform = trackingPlatform ?? EmergencyTrackingPlatform();

  final WatchApiClient _api;
  final SecureCredentialStore _credentials;
  final PreferencesStore _preferences;
  final ConnectivityService _connectivity;
  final GeolocatorPlatform _geolocator;
  final Future<Position?> Function()? _positionProvider;
  final EmergencyTrackingPlatform _trackingPlatform;

  Timer? _trackingTimer;
  bool _emergencyActive = false;
  String? _activeSosEventId;
  WatchLocationAccessResult? _lastAccess;

  static const emergencyInterval = Duration(seconds: 5);
  static const idleInterval = Duration(seconds: 60);

  WatchLocationAccessResult? get lastAccess => _lastAccess;

  Future<WatchLocationAccessResult> resolveAccess({
    bool requestIfDenied = true,
    bool allowCachedFallback = true,
  }) async {
    if (_positionProvider != null) {
      final position = await _positionProvider();
      _lastAccess = WatchLocationAccessResult(
        state: position == null
            ? WatchLocationPermissionState.unavailable
            : WatchLocationPermissionState.grantedPrecise,
        position: position,
        source: position == null
            ? WatchLocationSource.unavailable
            : WatchLocationSource.watchGps,
      );
      return _lastAccess!;
    }
    _lastAccess = await resolveWatchLocationAccess(
      requestIfDenied: requestIfDenied,
      allowCachedFallback: allowCachedFallback,
      geolocator: _geolocator,
    );
    return _lastAccess!;
  }

  Future<WatchLocationPermissionState> readPermissionState({
    bool requestIfDenied = false,
  }) =>
      resolveWatchLocationPermissionState(
        requestIfDenied: requestIfDenied,
        geolocator: _geolocator,
      );

  Future<bool> requestPermission() async {
    final state = await resolveWatchLocationPermissionState(
      requestIfDenied: true,
      geolocator: _geolocator,
    );
    return state == WatchLocationPermissionState.grantedPrecise ||
        state == WatchLocationPermissionState.grantedApproximate;
  }

  Future<Position?> getCurrentPosition({bool requestIfDenied = true}) async {
    final access = await resolveAccess(
      requestIfDenied: requestIfDenied,
      allowCachedFallback: true,
    );
    return access.position;
  }

  Future<void> startEmergencyTracking({String? sosEventId}) async {
    _emergencyActive = true;
    _activeSosEventId = sosEventId;
    await _preferences.saveActiveEmergencyTracking(
      sosEventId: sosEventId,
      active: true,
    );
    await _trackingPlatform.startEmergencyTracking(
      sosEventId: sosEventId,
      silent: false,
    );
    _restartTimer(sosEventId: sosEventId, interval: emergencyInterval);
  }

  Future<void> startIdleTracking() async {
    if (_emergencyActive) return;
    final permission = await readPermissionState(requestIfDenied: false);
    if (permission != WatchLocationPermissionState.grantedPrecise &&
        permission != WatchLocationPermissionState.grantedApproximate) {
      return;
    }
    _restartTimer(interval: idleInterval);
  }

  Future<void> stopTracking() async {
    _trackingTimer?.cancel();
    _trackingTimer = null;
    _emergencyActive = false;
    _activeSosEventId = null;
    await _preferences.saveActiveEmergencyTracking(active: false);
    await _trackingPlatform.stopEmergencyTracking();
  }

  Future<void> restoreEmergencyTrackingIfNeeded() async {
    final snapshot = await _preferences.loadActiveEmergencyTracking();
    if (snapshot?.active != true) return;
    final permission = await readPermissionState(requestIfDenied: false);
    if (permission != WatchLocationPermissionState.grantedPrecise &&
        permission != WatchLocationPermissionState.grantedApproximate) {
      return;
    }
    await startEmergencyTracking(sosEventId: snapshot?.sosEventId);
  }

  void _restartTimer({String? sosEventId, required Duration interval}) {
    _trackingTimer?.cancel();
    _trackingTimer = Timer.periodic(interval, (_) {
      unawaited(_sendGpsTick(sosEventId: sosEventId ?? _activeSosEventId));
    });
  }

  Future<void> _sendGpsTick({String? sosEventId}) async {
    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    if (deviceId == null || deviceSecret == null) return;

    final access = await resolveAccess(
      requestIfDenied: false,
      allowCachedFallback: true,
    );
    final position = access.position;
    if (position == null) return;

    final payload = _gpsPayload(
      deviceId: deviceId,
      deviceSecret: deviceSecret,
      position: position,
      access: access,
      sosEventId: sosEventId,
    );

    if (_connectivity.activeMode == WatchConnectivityMode.offline) {
      await _enqueueOfflineGps(payload);
      return;
    }

    try {
      await _api.post(WatchApiPaths.gps(deviceId), body: payload);
    } catch (_) {
      await _enqueueOfflineGps(payload);
    }
  }

  Map<String, dynamic> _gpsPayload({
    required String deviceId,
    required String deviceSecret,
    required Position position,
    required WatchLocationAccessResult access,
    String? sosEventId,
  }) {
    return {
      'deviceId': deviceId,
      'deviceSecret': deviceSecret,
      'latitude': position.latitude,
      'longitude': position.longitude,
      'accuracy': position.accuracy,
      'speed': position.speed,
      'heading': position.heading,
      'altitude': position.altitude,
      'capturedAt': position.timestamp.toUtc().toIso8601String(),
      'sourceMode': _connectivity.activeMode.apiValue,
      if (sosEventId != null) 'sosEventId': sosEventId,
      'metadata': watchLocationMetadataFields(access),
    };
  }

  Future<void> _enqueueOfflineGps(Map<String, dynamic> payload) async {
    final queue = await _preferences.loadOfflineQueue();
    queue.add(OfflineEvent(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      type: OfflineEventType.gps,
      payload: payload,
      occurredAt: DateTime.now(),
    ));
    await _preferences.saveOfflineQueue(queue);
  }

  bool get isEmergencyActive => _emergencyActive;
}
