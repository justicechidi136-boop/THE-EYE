import "package:geolocator/geolocator.dart";

import "device_location_state.dart";
import "emergency_location_fix.dart";
import "location_permission_service.dart";
import "location_reverse_geocode.dart";
import "location_types.dart";

/// Probes fresh device location for settings/diagnostics — not incident intake.
class DeviceLocationService {
  DeviceLocationService({
    LocationReverseGeocoder? reverseGeocoder,
    GeolocatorPlatform? geolocator,
  })  : _reverseGeocoder =
            reverseGeocoder ?? const PlatformLocationReverseGeocoder(),
        _geolocator = geolocator ?? GeolocatorPlatform.instance;

  final LocationReverseGeocoder _reverseGeocoder;
  final GeolocatorPlatform _geolocator;
  Future<DeviceLocationState>? _activeProbe;

  Future<DeviceLocationState> probeCurrentLocation({
    Duration timeout = const Duration(seconds: 15),
    bool requestIfDenied = true,
  }) {
    final existing = _activeProbe;
    if (existing != null) return existing;
    final probe = _runProbe(
      timeout: timeout,
      requestIfDenied: requestIfDenied,
    ).catchError((Object _, StackTrace __) {
      return DeviceLocationState(
        status: DeviceLocationStatus.failed,
        errorCode: LocationTestErrorCode.unexpectedFailure,
        message: "Current device location test failed unexpectedly.",
      );
    });
    _activeProbe = probe;
    return probe.whenComplete(() {
      if (_activeProbe == probe) {
        _activeProbe = null;
      }
    });
  }

  Future<DeviceLocationState> _runProbe({
    required Duration timeout,
    required bool requestIfDenied,
  }) async {
    final requestId = "loc-test-${DateTime.now().microsecondsSinceEpoch}";

    var state = DeviceLocationState(
      status: DeviceLocationStatus.checkingPermission,
      requestId: requestId,
    );

    final permissionState = await resolveLocationPermissionState(
      requestIfDenied: requestIfDenied,
      geolocator: _geolocator,
    );
    state = state.copyWith(permissionState: permissionState);

    if (permissionState == LocationPermissionState.serviceDisabled) {
      return state.copyWith(
        status: DeviceLocationStatus.serviceDisabled,
        serviceEnabled: false,
        message: permissionStateMessage(permissionState),
        errorCode: LocationTestErrorCode.serviceDisabled,
      );
    }

    if (permissionState == LocationPermissionState.denied) {
      return state.copyWith(
        status: DeviceLocationStatus.denied,
        message: permissionStateMessage(permissionState),
        errorCode: LocationTestErrorCode.permissionDenied,
      );
    }

    if (permissionState == LocationPermissionState.deniedPermanently ||
        permissionState == LocationPermissionState.restricted) {
      return state.copyWith(
        status: DeviceLocationStatus.permanentlyDenied,
        message: permissionStateMessage(permissionState),
        errorCode: LocationTestErrorCode.permanentlyDenied,
      );
    }

    final serviceEnabled = await _geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return state.copyWith(
        status: DeviceLocationStatus.serviceDisabled,
        serviceEnabled: false,
        message: permissionStateMessage(
          LocationPermissionState.serviceDisabled,
        ),
        errorCode: LocationTestErrorCode.serviceDisabled,
      );
    }

    state = state.copyWith(
      status: DeviceLocationStatus.acquiring,
      serviceEnabled: true,
    );

    final outcome = await captureLocationOutcome(
      timeout: timeout,
      requestIfDenied: false,
      geolocator: _geolocator,
    );

    if (outcome.result != LocationCaptureResult.granted ||
        outcome.position == null) {
      return state.copyWith(
        status: _statusForCaptureResult(outcome.result),
        message: locationFailureMessage(outcome.result),
        errorCode: _errorCodeForCaptureResult(outcome.result),
      );
    }

    final position = outcome.position!;
    final capturedAt = position.timestamp.toUtc();
    final ageSeconds = DateTime.now().difference(capturedAt).inSeconds;
    final isCached = ageSeconds > 30;
    final fix = evaluatePosition(
      position: position,
      source: isCached
          ? EmergencyLocationSource.cachedDevice
          : EmergencyLocationSource.freshGps,
      isCached: isCached,
      permissionState: permissionState,
      serviceEnabled: true,
      requestId: requestId,
    );
    if (fix == null) {
      return state.copyWith(
        status: DeviceLocationStatus.unavailable,
        message: "Current device location is unavailable.",
        errorCode: LocationTestErrorCode.invalidFix,
      );
    }

    final geocode = await _reverseGeocoder.lookup(
      latitude: position.latitude,
      longitude: position.longitude,
    );
    final reverseGeocodeFailed = !geocode.hasAnyLabel;

    return DeviceLocationState(
      status: isCached
          ? DeviceLocationStatus.cached
          : DeviceLocationStatus.acquired,
      latitude: position.latitude,
      longitude: position.longitude,
      accuracyMeters: position.accuracy,
      capturedAt: capturedAt,
      ageSeconds: ageSeconds,
      source: isCached
          ? DeviceLocationSourceKind.cachedDevice
          : DeviceLocationSourceKind.freshGps,
      quality: fix.quality,
      locality: geocode.locality,
      street: geocode.street,
      subLocality: geocode.subLocality,
      lga: geocode.lga,
      state: geocode.state,
      country: geocode.country,
      isCached: isCached,
      permissionState: permissionState,
      serviceEnabled: true,
      requestId: requestId,
      message: isCached
          ? "Still trying to obtain a fresh GPS position."
          : reverseGeocodeFailed
              ? "Location acquired — address unavailable."
              : null,
      errorCode: reverseGeocodeFailed
          ? LocationTestErrorCode.reverseGeocodeFailed
          : null,
    );
  }

  DeviceLocationStatus _statusForCaptureResult(LocationCaptureResult result) {
    switch (result) {
      case LocationCaptureResult.denied:
        return DeviceLocationStatus.denied;
      case LocationCaptureResult.deniedForever:
        return DeviceLocationStatus.permanentlyDenied;
      case LocationCaptureResult.serviceDisabled:
        return DeviceLocationStatus.serviceDisabled;
      case LocationCaptureResult.timeout:
        return DeviceLocationStatus.timedOut;
      case LocationCaptureResult.granted:
        return DeviceLocationStatus.unavailable;
    }
  }

  String? _errorCodeForCaptureResult(LocationCaptureResult result) {
    switch (result) {
      case LocationCaptureResult.denied:
        return LocationTestErrorCode.permissionDenied;
      case LocationCaptureResult.deniedForever:
        return LocationTestErrorCode.permanentlyDenied;
      case LocationCaptureResult.serviceDisabled:
        return LocationTestErrorCode.serviceDisabled;
      case LocationCaptureResult.timeout:
        return LocationTestErrorCode.acquisitionTimeout;
      case LocationCaptureResult.granted:
        return LocationTestErrorCode.acquisitionTimeout;
    }
  }
}

ProfileJurisdictionDisplay profileJurisdictionFromProfile({
  String? country,
  String? state,
  String? lga,
  bool complete = false,
}) {
  return ProfileJurisdictionDisplay(
    country: country,
    state: state,
    lga: lga,
    complete: complete,
  );
}
