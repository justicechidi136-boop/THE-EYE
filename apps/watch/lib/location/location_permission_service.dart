import 'dart:async';

import 'package:geolocator/geolocator.dart';

enum WatchLocationPermissionState {
  notRequested,
  grantedApproximate,
  grantedPrecise,
  denied,
  deniedPermanently,
  serviceDisabled,
  restricted,
  unavailable,
  acquiring,
  timedOut,
  error,
}

enum WatchLocationRecoveryAction {
  none,
  retry,
  openAppSettings,
  openLocationSettings,
}

enum WatchLocationSource {
  watchGps,
  cachedWatch,
  phoneRelay,
  unavailable,
}

class WatchLocationAccessResult {
  const WatchLocationAccessResult({
    required this.state,
    this.position,
    this.source = WatchLocationSource.unavailable,
    this.isCached = false,
    this.ageSeconds,
    this.message = '',
    this.recoveryAction = WatchLocationRecoveryAction.none,
  });

  final WatchLocationPermissionState state;
  final Position? position;
  final WatchLocationSource source;
  final bool isCached;
  final int? ageSeconds;
  final String message;
  final WatchLocationRecoveryAction recoveryAction;

  bool get hasFix =>
      position != null &&
      (state == WatchLocationPermissionState.grantedPrecise ||
          state == WatchLocationPermissionState.grantedApproximate);
}

const watchLocationPermissionTimeout = Duration(seconds: 12);
const watchEmergencyLocationTimeout = Duration(seconds: 10);

WatchLocationPermissionState mapWatchPermission(LocationPermission permission) {
  switch (permission) {
    case LocationPermission.always:
    case LocationPermission.whileInUse:
      return WatchLocationPermissionState.grantedPrecise;
    case LocationPermission.denied:
      return WatchLocationPermissionState.denied;
    case LocationPermission.deniedForever:
      return WatchLocationPermissionState.deniedPermanently;
    case LocationPermission.unableToDetermine:
      return WatchLocationPermissionState.restricted;
  }
}

Future<WatchLocationPermissionState> resolveWatchLocationPermissionState({
  bool requestIfDenied = true,
  GeolocatorPlatform? geolocator,
}) async {
  final platform = geolocator ?? GeolocatorPlatform.instance;
  final enabled = await platform.isLocationServiceEnabled().timeout(
        watchLocationPermissionTimeout,
        onTimeout: () => false,
      );
  if (!enabled) {
    return WatchLocationPermissionState.serviceDisabled;
  }

  var permission = await platform.checkPermission().timeout(
        watchLocationPermissionTimeout,
        onTimeout: () => LocationPermission.denied,
      );
  if (permission == LocationPermission.denied) {
    if (!requestIfDenied) {
      return WatchLocationPermissionState.denied;
    }
    permission = await platform.requestPermission().timeout(
          watchLocationPermissionTimeout,
          onTimeout: () => LocationPermission.denied,
        );
  }
  return mapWatchPermission(permission);
}

Future<WatchLocationAccessResult> resolveWatchLocationAccess({
  LocationAccuracy accuracy = LocationAccuracy.high,
  Duration timeout = watchEmergencyLocationTimeout,
  bool requestIfDenied = true,
  bool allowCachedFallback = true,
  GeolocatorPlatform? geolocator,
}) async {
  final platform = geolocator ?? GeolocatorPlatform.instance;
  final permissionState = await resolveWatchLocationPermissionState(
    requestIfDenied: requestIfDenied,
    geolocator: platform,
  );

  if (permissionState == WatchLocationPermissionState.serviceDisabled) {
    return WatchLocationAccessResult(
      state: permissionState,
      message: watchLocationStateMessage(permissionState),
      recoveryAction: WatchLocationRecoveryAction.openLocationSettings,
    );
  }
  if (permissionState == WatchLocationPermissionState.denied) {
    return WatchLocationAccessResult(
      state: permissionState,
      message: watchLocationStateMessage(permissionState),
      recoveryAction: WatchLocationRecoveryAction.retry,
    );
  }
  if (permissionState == WatchLocationPermissionState.deniedPermanently) {
    return WatchLocationAccessResult(
      state: permissionState,
      message: watchLocationStateMessage(permissionState),
      recoveryAction: WatchLocationRecoveryAction.openAppSettings,
    );
  }

  try {
    final position = await platform.getCurrentPosition(
      locationSettings: LocationSettings(
        accuracy: accuracy,
        timeLimit: timeout,
      ),
    ).timeout(timeout);
    return WatchLocationAccessResult(
      state: permissionState,
      position: position,
      source: WatchLocationSource.watchGps,
    );
  } on TimeoutException {
    if (allowCachedFallback) {
      final cached = await _readCachedWatchPosition(platform);
      if (cached != null) return cached;
    }
    return WatchLocationAccessResult(
      state: WatchLocationPermissionState.timedOut,
      message: watchLocationStateMessage(WatchLocationPermissionState.timedOut),
      recoveryAction: WatchLocationRecoveryAction.retry,
    );
  } catch (_) {
    if (allowCachedFallback) {
      final cached = await _readCachedWatchPosition(platform);
      if (cached != null) return cached;
    }
    return WatchLocationAccessResult(
      state: WatchLocationPermissionState.unavailable,
      message:
          watchLocationStateMessage(WatchLocationPermissionState.unavailable),
      recoveryAction: WatchLocationRecoveryAction.retry,
    );
  }
}

Future<WatchLocationAccessResult?> _readCachedWatchPosition(
  GeolocatorPlatform platform,
) async {
  try {
    final last = await platform.getLastKnownPosition();
    if (last == null) return null;
    final ageSeconds =
        DateTime.now().difference(last.timestamp.toLocal()).inSeconds;
    return WatchLocationAccessResult(
      state: WatchLocationPermissionState.grantedPrecise,
      position: last,
      source: WatchLocationSource.cachedWatch,
      isCached: true,
      ageSeconds: ageSeconds,
      message: 'Last fix ${ageSeconds}s old',
      recoveryAction: WatchLocationRecoveryAction.retry,
    );
  } catch (_) {
    return null;
  }
}

String watchLocationStateMessage(WatchLocationPermissionState state) {
  switch (state) {
    case WatchLocationPermissionState.notRequested:
      return 'Location permission is required for SOS.';
    case WatchLocationPermissionState.grantedApproximate:
    case WatchLocationPermissionState.grantedPrecise:
      return '';
    case WatchLocationPermissionState.denied:
      return 'Allow location so responders can find you.';
    case WatchLocationPermissionState.deniedPermanently:
      return 'Location blocked. Open Settings to enable it.';
    case WatchLocationPermissionState.serviceDisabled:
      return 'Turn on Location Services on your watch.';
    case WatchLocationPermissionState.restricted:
      return 'Location access is restricted.';
    case WatchLocationPermissionState.unavailable:
      return 'GPS unavailable.';
    case WatchLocationPermissionState.acquiring:
      return 'Getting GPS fix...';
    case WatchLocationPermissionState.timedOut:
      return 'No GPS fix yet. SOS can still be sent.';
    case WatchLocationPermissionState.error:
      return 'Location error.';
  }
}

String watchSosLocationMessage(
  WatchLocationAccessResult access, {
  required bool submitted,
}) {
  if (access.hasFix && !access.isCached) {
    return submitted ? 'SOS sent with watch GPS.' : 'Watch GPS ready.';
  }
  if (access.hasFix && access.isCached) {
    return submitted
        ? 'SOS sent with cached fix (${access.ageSeconds ?? 0}s old).'
        : access.message;
  }
  if (submitted) {
    return 'SOS sent. Location pending.';
  }
  return access.message;
}

Future<void> openWatchLocationSettings() => Geolocator.openLocationSettings();

Future<void> openWatchAppSettings() => Geolocator.openAppSettings();

Map<String, Object?> watchLocationMetadataFields(WatchLocationAccessResult access) {
  return {
    'locationSource': switch (access.source) {
      WatchLocationSource.watchGps => 'watchGps',
      WatchLocationSource.cachedWatch => 'cachedWatch',
      WatchLocationSource.phoneRelay => 'phoneRelay',
      WatchLocationSource.unavailable => 'unavailable',
    },
    'locationStatus': access.hasFix
        ? (access.isCached ? 'cached' : 'live')
        : 'pending',
    if (access.isCached) 'isCached': true,
    if (access.ageSeconds != null) 'ageSeconds': access.ageSeconds,
  };
}
