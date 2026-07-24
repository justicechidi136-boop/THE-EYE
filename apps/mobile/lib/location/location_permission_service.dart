import "package:geolocator/geolocator.dart";

import "emergency_location_coordinator.dart";
import "emergency_location_fix.dart";
import "location_types.dart";

export "emergency_foreground_service.dart";
export "emergency_location_coordinator.dart";
export "emergency_location_fix.dart";
export "location_types.dart";

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
  final coordinator =
      sharedEmergencyLocationCoordinator(geolocator: geolocator);
  if (!allowCachedFallback) {
    final outcome = await coordinator.captureFreshOutcome(
      accuracy: accuracy,
      timeout: timeout,
      requestIfDenied: requestIfDenied,
    );
    if (outcome.position != null) {
      return LocationAccessResult(
        state: LocationPermissionState.grantedPrecise,
        position: outcome.position,
        source: LocationSource.mobileGps,
      );
    }
    return LocationAccessResult(
      state: switch (outcome.result) {
        LocationCaptureResult.denied => LocationPermissionState.denied,
        LocationCaptureResult.deniedForever =>
          LocationPermissionState.deniedPermanently,
        LocationCaptureResult.serviceDisabled =>
          LocationPermissionState.serviceDisabled,
        _ => LocationPermissionState.timedOut,
      },
      message: locationFailureMessage(outcome.result),
      recoveryAction: switch (outcome.result) {
        LocationCaptureResult.deniedForever =>
          LocationRecoveryAction.openAppSettings,
        LocationCaptureResult.serviceDisabled =>
          LocationRecoveryAction.openLocationSettings,
        _ => LocationRecoveryAction.retry,
      },
      errorCode: switch (outcome.result) {
        LocationCaptureResult.denied => LocationErrorCode.permissionDenied,
        LocationCaptureResult.deniedForever =>
          LocationErrorCode.permanentlyDenied,
        LocationCaptureResult.serviceDisabled =>
          LocationErrorCode.serviceDisabled,
        _ => LocationErrorCode.acquisitionTimeout,
      },
    );
  }

  return coordinator.acquireForEmergencySubmission(
    submissionDeadline: timeout,
    requestIfDenied: requestIfDenied,
  );
}

Future<LocationCaptureOutcome> captureLocationOutcome({
  LocationAccuracy accuracy = LocationAccuracy.high,
  Duration timeout = kLocationCaptureTimeout,
  bool requestIfDenied = true,
  GeolocatorPlatform? geolocator,
}) {
  if (geolocator != null) {
    resetSharedEmergencyLocationCoordinator();
  }
  return sharedEmergencyLocationCoordinator(geolocator: geolocator)
      .captureFreshOutcome(
    accuracy: accuracy,
    timeout: timeout,
    requestIfDenied: requestIfDenied,
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
      return "Location access is off. Your emergency can still be sent, but responders may not see your precise position.";
    case LocationPermissionState.deniedPermanently:
      return "Location access is off. Your emergency can still be sent, but responders may not see your precise position.";
    case LocationPermissionState.serviceDisabled:
      return "Turn on Location Services to share your live position.";
    case LocationPermissionState.restricted:
      return "Location access is restricted on this device.";
    case LocationPermissionState.unavailable:
      return "GPS is unavailable right now.";
    case LocationPermissionState.acquiring:
      return "Acquiring GPS fix...";
    case LocationPermissionState.timedOut:
      return "Your emergency has been submitted. We are still trying to get your precise location.";
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
    final lowAccuracy = lowAccuracyLocationMessage(
      access.quality ?? EmergencyLocationQuality.precise,
    );
    if (submitted) {
      return lowAccuracy.isNotEmpty
          ? "SOS sent. $lowAccuracy"
          : "SOS sent with your GPS location.";
    }
    return lowAccuracy.isNotEmpty ? lowAccuracy : "GPS location captured.";
  }
  if (access.hasFix && access.isCached) {
    return submitted
        ? "Your SOS was sent using your last known location (${access.ageSeconds ?? 0}s old). We are still trying to get a fresh GPS position."
        : cachedLocationUserMessage(access.ageSeconds ?? 0);
  }
  if (submitted) {
    return emergencyLocationRetryMessage(access);
  }
  return access.message.isNotEmpty
      ? access.message
      : "Location permission is required to provide your precise emergency location.";
}

Future<void> openLocationSettings() => Geolocator.openLocationSettings();

Future<void> openAppSettings() => Geolocator.openAppSettings();

Map<String, Object?> locationMetadataFields(LocationAccessResult access) {
  if (!access.hasFix) {
    final status = switch (access.state) {
      LocationPermissionState.denied ||
      LocationPermissionState.deniedPermanently =>
        "denied",
      LocationPermissionState.serviceDisabled => "serviceDisabled",
      _ => "pending",
    };
    return {
      "locationSource": "unavailable",
      "locationStatus": status,
      if (access.errorCode != null) "locationErrorCode": access.errorCode,
      if (access.requestId != null) "locationRequestId": access.requestId,
    };
  }

  return {
    "locationSource": switch (access.source) {
      LocationSource.mobileGps => "freshGps",
      LocationSource.cachedMobile => "cachedDevice",
      LocationSource.unavailable => "unavailable",
    },
    "locationStatus": access.isCached ? "cached" : "available",
    if (access.isCached) "isCached": true,
    if (access.ageSeconds != null) "ageSeconds": access.ageSeconds,
    if (access.position != null) "accuracyMeters": access.position!.accuracy,
    if (access.quality != null) "quality": mapQualityToApi(access.quality!),
    if (access.requestId != null) "locationRequestId": access.requestId,
  };
}
