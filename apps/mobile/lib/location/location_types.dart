import "dart:async";

import "package:geolocator/geolocator.dart";

import "emergency_location_fix.dart";

/// Typed permission and GPS lifecycle states shared across mobile flows.
enum LocationPermissionState {
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

enum LocationRecoveryAction {
  none,
  retry,
  openAppSettings,
  openLocationSettings,
}

enum LocationSource {
  mobileGps,
  cachedMobile,
  unavailable,
}

class LocationAccessResult {
  const LocationAccessResult({
    required this.state,
    this.position,
    this.source = LocationSource.unavailable,
    this.isCached = false,
    this.ageSeconds,
    this.message = "",
    this.recoveryAction = LocationRecoveryAction.none,
    this.quality,
    this.errorCode,
    this.requestId,
  });

  final LocationPermissionState state;
  final Position? position;
  final LocationSource source;
  final bool isCached;
  final int? ageSeconds;
  final String message;
  final LocationRecoveryAction recoveryAction;
  final EmergencyLocationQuality? quality;
  final String? errorCode;
  final String? requestId;

  bool get hasFix =>
      position != null &&
      (state == LocationPermissionState.grantedPrecise ||
          state == LocationPermissionState.grantedApproximate);

  bool get allowsEmergencySubmission =>
      hasFix ||
      state == LocationPermissionState.timedOut ||
      state == LocationPermissionState.unavailable ||
      state == LocationPermissionState.denied ||
      state == LocationPermissionState.deniedPermanently ||
      state == LocationPermissionState.serviceDisabled;
}

enum LocationCaptureResult {
  granted,
  denied,
  deniedForever,
  serviceDisabled,
  timeout,
}

const kLocationCaptureTimeout = Duration(seconds: 20);
const kLocationPermissionTimeout = Duration(seconds: 15);
const kEmergencyLocationTimeout = Duration(seconds: 12);

class LocationCaptureOutcome {
  const LocationCaptureOutcome({this.position, required this.result});

  final Position? position;
  final LocationCaptureResult result;
}

LocationPermissionState mapPermissionToState(LocationPermission permission) {
  switch (permission) {
    case LocationPermission.always:
    case LocationPermission.whileInUse:
      return LocationPermissionState.grantedPrecise;
    case LocationPermission.denied:
      return LocationPermissionState.denied;
    case LocationPermission.deniedForever:
      return LocationPermissionState.deniedPermanently;
    case LocationPermission.unableToDetermine:
      return LocationPermissionState.restricted;
  }
}

LocationCaptureResult mapStateToCaptureResult(LocationPermissionState state) {
  switch (state) {
    case LocationPermissionState.grantedApproximate:
    case LocationPermissionState.grantedPrecise:
      return LocationCaptureResult.granted;
    case LocationPermissionState.denied:
    case LocationPermissionState.notRequested:
      return LocationCaptureResult.denied;
    case LocationPermissionState.deniedPermanently:
      return LocationCaptureResult.deniedForever;
    case LocationPermissionState.serviceDisabled:
      return LocationCaptureResult.serviceDisabled;
    case LocationPermissionState.timedOut:
    case LocationPermissionState.acquiring:
      return LocationCaptureResult.timeout;
    case LocationPermissionState.restricted:
    case LocationPermissionState.unavailable:
    case LocationPermissionState.error:
      return LocationCaptureResult.timeout;
  }
}

Future<LocationPermissionState> resolveLocationPermissionState({
  bool requestIfDenied = true,
  GeolocatorPlatform? geolocator,
}) async {
  final platform = geolocator ?? GeolocatorPlatform.instance;
  final enabled = await platform.isLocationServiceEnabled().timeout(
        kLocationPermissionTimeout,
        onTimeout: () => false,
      );
  if (!enabled) {
    return LocationPermissionState.serviceDisabled;
  }

  var permission = await platform.checkPermission().timeout(
        kLocationPermissionTimeout,
        onTimeout: () => LocationPermission.denied,
      );
  if (permission == LocationPermission.denied) {
    if (!requestIfDenied) {
      return LocationPermissionState.denied;
    }
    permission = await platform.requestPermission().timeout(
          kLocationPermissionTimeout,
          onTimeout: () => LocationPermission.denied,
        );
  }
  return mapPermissionToState(permission);
}

bool locationPermissionAllowsRead(LocationPermission permission) {
  return permission == LocationPermission.always ||
      permission == LocationPermission.whileInUse;
}

String cachedLocationUserMessage(int ageSeconds) =>
    "Using your last known location while we get a fresh GPS position (${ageSeconds}s old).";

String lowAccuracyLocationMessage(EmergencyLocationQuality quality) {
  if (quality == EmergencyLocationQuality.lowAccuracy) {
    return "Location found, but accuracy is limited. Keep the phone near a window or open area.";
  }
  return "";
}

String permissionStateMessage(LocationPermissionState state) {
  switch (state) {
    case LocationPermissionState.denied:
    case LocationPermissionState.deniedPermanently:
      return "Location access is off. Your emergency can still be sent, but responders may not see your precise position.";
    case LocationPermissionState.serviceDisabled:
      return "Turn on Location Services to share your live position.";
    case LocationPermissionState.restricted:
      return "Location access is restricted on this device.";
    default:
      return "";
  }
}

String emergencyLocationRetryMessage(LocationAccessResult access) {
  if (access.hasFix && access.isCached) {
    return cachedLocationUserMessage(access.ageSeconds ?? 0);
  }
  if (access.state == LocationPermissionState.denied ||
      access.state == LocationPermissionState.deniedPermanently) {
    return "Location access is off. Your emergency can still be sent, but responders may not see your precise position.";
  }
  if (access.state == LocationPermissionState.serviceDisabled) {
    return "Turn on Location Services to share your live position.";
  }
  return "Your emergency has been submitted. We are still trying to get your precise location.";
}
