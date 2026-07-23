import "dart:async";

import "package:geolocator/geolocator.dart";

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
  });

  final LocationPermissionState state;
  final Position? position;
  final LocationSource source;
  final bool isCached;
  final int? ageSeconds;
  final String message;
  final LocationRecoveryAction recoveryAction;

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

/// Legacy capture result kept for existing call sites/tests.
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

Future<LocationCaptureResult> resolveLocationPermission({
  bool requestIfDenied = true,
}) async {
  final state = await resolveLocationPermissionState(
    requestIfDenied: requestIfDenied,
  );
  return mapStateToCaptureResult(state);
}

Future<LocationAccessResult> resolveLocationAccess({
  LocationAccuracy accuracy = LocationAccuracy.high,
  Duration timeout = kEmergencyLocationTimeout,
  bool requestIfDenied = true,
  bool allowCachedFallback = true,
  GeolocatorPlatform? geolocator,
}) async {
  final platform = geolocator ?? GeolocatorPlatform.instance;
  final permissionState = await resolveLocationPermissionState(
    requestIfDenied: requestIfDenied,
    geolocator: platform,
  );

  if (permissionState == LocationPermissionState.serviceDisabled) {
    return LocationAccessResult(
      state: permissionState,
      message: locationStateMessage(permissionState),
      recoveryAction: LocationRecoveryAction.openLocationSettings,
    );
  }
  if (permissionState == LocationPermissionState.denied) {
    return LocationAccessResult(
      state: permissionState,
      message: locationStateMessage(permissionState),
      recoveryAction: LocationRecoveryAction.retry,
    );
  }
  if (permissionState == LocationPermissionState.deniedPermanently) {
    return LocationAccessResult(
      state: permissionState,
      message: locationStateMessage(permissionState),
      recoveryAction: LocationRecoveryAction.openAppSettings,
    );
  }
  if (permissionState == LocationPermissionState.restricted) {
    return LocationAccessResult(
      state: permissionState,
      message: locationStateMessage(permissionState),
      recoveryAction: LocationRecoveryAction.openAppSettings,
    );
  }

  try {
    final position = await platform
        .getCurrentPosition(
          locationSettings: LocationSettings(
            accuracy: accuracy,
            timeLimit: timeout,
          ),
        )
        .timeout(timeout);
    return LocationAccessResult(
      state: permissionState,
      position: position,
      source: LocationSource.mobileGps,
      message: "",
    );
  } on TimeoutException {
    if (allowCachedFallback) {
      final cached = await _readCachedPosition(platform);
      if (cached != null) {
        return cached;
      }
    }
    return LocationAccessResult(
      state: LocationPermissionState.timedOut,
      message: locationStateMessage(LocationPermissionState.timedOut),
      recoveryAction: LocationRecoveryAction.retry,
    );
  } catch (_) {
    if (allowCachedFallback) {
      final cached = await _readCachedPosition(platform);
      if (cached != null) {
        return cached;
      }
    }
    return LocationAccessResult(
      state: LocationPermissionState.unavailable,
      message: locationStateMessage(LocationPermissionState.unavailable),
      recoveryAction: LocationRecoveryAction.retry,
    );
  }
}

Future<LocationAccessResult?> _readCachedPosition(
  GeolocatorPlatform platform,
) async {
  try {
    final last = await platform.getLastKnownPosition();
    if (last == null) return null;
    final ageSeconds =
        DateTime.now().difference(last.timestamp.toLocal()).inSeconds;
    return LocationAccessResult(
      state: LocationPermissionState.grantedPrecise,
      position: last,
      source: LocationSource.cachedMobile,
      isCached: true,
      ageSeconds: ageSeconds,
      message:
          "Using your last known location (${ageSeconds}s old). Live GPS retry continues.",
      recoveryAction: LocationRecoveryAction.retry,
    );
  } catch (_) {
    return null;
  }
}

Future<LocationCaptureOutcome> captureLocationOutcome({
  LocationAccuracy accuracy = LocationAccuracy.high,
  Duration timeout = kLocationCaptureTimeout,
  bool requestIfDenied = true,
}) async {
  final access = await resolveLocationAccess(
    accuracy: accuracy,
    timeout: timeout,
    requestIfDenied: requestIfDenied,
    allowCachedFallback: false,
  );
  if (access.hasFix) {
    return LocationCaptureOutcome(
      position: access.position,
      result: LocationCaptureResult.granted,
    );
  }
  return LocationCaptureOutcome(
    result: mapStateToCaptureResult(access.state),
  );
}

String locationStateMessage(LocationPermissionState state) {
  switch (state) {
    case LocationPermissionState.notRequested:
      return "Location permission is required to provide your precise emergency location.";
    case LocationPermissionState.grantedApproximate:
    case LocationPermissionState.grantedPrecise:
      return "";
    case LocationPermissionState.denied:
      return "Location permission is required to provide your precise emergency location.";
    case LocationPermissionState.deniedPermanently:
      return "Location access is permanently denied. Open Settings to enable it.";
    case LocationPermissionState.serviceDisabled:
      return "Turn on Location Services to share your position.";
    case LocationPermissionState.restricted:
      return "Location access is restricted on this device.";
    case LocationPermissionState.unavailable:
      return "GPS is unavailable right now.";
    case LocationPermissionState.acquiring:
      return "Acquiring GPS fix...";
    case LocationPermissionState.timedOut:
      return "We could not get a GPS fix. Your emergency can still be submitted and location retry continues.";
    case LocationPermissionState.error:
      return "Location could not be read.";
  }
}

String locationFailureMessage(LocationCaptureResult result) {
  return locationStateMessage(
    switch (result) {
      LocationCaptureResult.granted => LocationPermissionState.grantedPrecise,
      LocationCaptureResult.denied => LocationPermissionState.denied,
      LocationCaptureResult.deniedForever =>
        LocationPermissionState.deniedPermanently,
      LocationCaptureResult.serviceDisabled =>
        LocationPermissionState.serviceDisabled,
      LocationCaptureResult.timeout => LocationPermissionState.timedOut,
    },
  );
}

String nearbyLocationNotice(LocationCaptureResult result) {
  switch (result) {
    case LocationCaptureResult.serviceDisabled:
      return "Location services are off. Search by state, LGA, or station name.";
    case LocationCaptureResult.deniedForever:
      return "Location permission is blocked. Open settings or search by area instead.";
    case LocationCaptureResult.denied:
      return "Location permission is required for nearest sorting. Search by area instead.";
    case LocationCaptureResult.timeout:
      return "GPS timed out. Search by state, LGA, or station name to find stations.";
    case LocationCaptureResult.granted:
      return "";
  }
}

String sosLocationUserMessage(LocationAccessResult access,
    {required bool submitted}) {
  if (access.hasFix && !access.isCached) {
    return submitted
        ? "SOS sent with your GPS location."
        : "GPS location captured.";
  }
  if (access.hasFix && access.isCached) {
    return submitted
        ? "Your SOS was sent using your last known location (${access.ageSeconds ?? 0}s old). Live GPS retry continues."
        : access.message;
  }
  if (submitted) {
    return "Your SOS was sent, but your location is not available yet. Location retry continues.";
  }
  return access.message.isNotEmpty
      ? access.message
      : "Location permission is required to provide your precise emergency location.";
}

bool locationPermissionAllowsRead(LocationPermission permission) {
  return permission == LocationPermission.always ||
      permission == LocationPermission.whileInUse;
}

Future<void> openLocationSettings() => Geolocator.openLocationSettings();

Future<void> openAppSettings() => Geolocator.openAppSettings();

Map<String, Object?> locationMetadataFields(LocationAccessResult access) {
  return {
    "locationSource": switch (access.source) {
      LocationSource.mobileGps => "mobileGps",
      LocationSource.cachedMobile => "cachedMobile",
      LocationSource.unavailable => "unavailable",
    },
    "locationStatus":
        access.hasFix ? (access.isCached ? "cached" : "live") : "pending",
    if (access.isCached) "isCached": true,
    if (access.ageSeconds != null) "ageSeconds": access.ageSeconds,
    if (access.position != null) "accuracyMeters": access.position!.accuracy,
  };
}
