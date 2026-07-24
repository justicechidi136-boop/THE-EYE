import "package:flutter_test/flutter_test.dart";
import "package:geolocator/geolocator.dart";
import "package:the_eye_mobile/location/location_permission_service.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    resetSharedEmergencyLocationCoordinator();
  });

  tearDown(() {
    resetSharedEmergencyLocationCoordinator();
  });

  group("evaluatePosition", () {
    test("accepts precise fresh fix", () {
      final fix = evaluatePosition(
        position: _position(accuracy: 10),
        source: EmergencyLocationSource.freshGps,
        isCached: false,
        permissionState: LocationPermissionState.grantedPrecise,
        serviceEnabled: true,
      );
      expect(fix?.quality, EmergencyLocationQuality.precise);
      expect(fix?.isUsableForSubmission, isTrue);
    });

    test("accepts cached fallback within threshold", () {
      final fix = evaluatePosition(
        position: _position(accuracy: 80, ageSeconds: 90),
        source: EmergencyLocationSource.cachedDevice,
        isCached: true,
        permissionState: LocationPermissionState.grantedPrecise,
        serviceEnabled: true,
      );
      expect(fix?.quality, EmergencyLocationQuality.acceptable);
      expect(fix?.isUsableForSubmission, isTrue);
    });

    test("rejects stale cached fix", () {
      final fix = evaluatePosition(
        position: _position(accuracy: 50, ageSeconds: 900),
        source: EmergencyLocationSource.cachedDevice,
        isCached: true,
        permissionState: LocationPermissionState.grantedPrecise,
        serviceEnabled: true,
      );
      expect(fix, isNull);
    });

    test("rejects zero coordinates", () {
      final fix = evaluatePosition(
        position: _position(latitude: 0, longitude: 0),
        source: EmergencyLocationSource.freshGps,
        isCached: false,
        permissionState: LocationPermissionState.grantedPrecise,
        serviceEnabled: true,
      );
      expect(fix, isNull);
    });
  });

  group("EmergencyLocationCoordinator", () {
    test("returns cached fix immediately when available", () async {
      final platform = _CachedThenFreshPlatform();
      final coordinator = EmergencyLocationCoordinator(geolocator: platform);
      final access = await coordinator.acquireForEmergencySubmission(
        submissionDeadline: const Duration(seconds: 1),
      );
      expect(access.hasFix, isTrue);
      expect(access.isCached, isTrue);
      expect(access.position!.latitude, 6.6012);
    });

    test("returns pending access when GPS unavailable", () async {
      final platform = _DeniedPermissionPlatform();
      final coordinator = EmergencyLocationCoordinator(geolocator: platform);
      final access = await coordinator.acquireForEmergencySubmission(
        submissionDeadline: const Duration(seconds: 1),
        requestIfDenied: false,
      );
      expect(access.hasFix, isFalse);
      expect(access.errorCode, LocationErrorCode.permissionDenied);
    });

    test("deduplicates concurrent acquisition requests", () async {
      final platform = _SlowGpsPlatform();
      final coordinator = EmergencyLocationCoordinator(geolocator: platform);
      final first = coordinator.acquireForEmergencySubmission(
        submissionDeadline: const Duration(seconds: 2),
      );
      final second = coordinator.acquireForEmergencySubmission(
        submissionDeadline: const Duration(seconds: 2),
      );
      final a = await first;
      final b = await second;
      expect(a.state, b.state);
      expect(platform.readCount, 1);
    });
  });

  group("location messages", () {
    test("timeout message no longer uses awkward GPS fix copy", () {
      expect(
        locationFailureMessage(LocationCaptureResult.timeout),
        contains("precise location"),
      );
      expect(
        locationFailureMessage(LocationCaptureResult.timeout),
        isNot(contains("location retry continue")),
      );
    });

    test("pending SOS metadata uses pending status", () {
      const access = LocationAccessResult(
        state: LocationPermissionState.timedOut,
      );
      expect(locationMetadataFields(access)['locationStatus'], 'pending');
    });
  });
}

Position _position({
  double latitude = 6.6012,
  double longitude = 3.3515,
  double accuracy = 12,
  int ageSeconds = 5,
}) {
  return Position(
    latitude: latitude,
    longitude: longitude,
    timestamp: DateTime.now().toUtc().subtract(Duration(seconds: ageSeconds)),
    accuracy: accuracy,
    altitude: 0,
    altitudeAccuracy: 0,
    heading: 0,
    headingAccuracy: 0,
    speed: 0,
    speedAccuracy: 0,
  );
}

class _CachedThenFreshPlatform extends GeolocatorPlatform {
  @override
  Future<LocationPermission> checkPermission() async =>
      LocationPermission.whileInUse;

  @override
  Future<bool> isLocationServiceEnabled() async => true;

  @override
  Future<Position?> getLastKnownPosition(
          {bool forceLocationManager = false}) async =>
      _position(accuracy: 80);

  @override
  Future<Position> getCurrentPosition(
      {LocationSettings? locationSettings}) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    return _position(accuracy: 8);
  }
}

class _DeniedPermissionPlatform extends GeolocatorPlatform {
  @override
  Future<LocationPermission> checkPermission() async =>
      LocationPermission.denied;

  @override
  Future<bool> isLocationServiceEnabled() async => true;
}

class _SlowGpsPlatform extends GeolocatorPlatform {
  _SlowGpsPlatform();

  int readCount = 0;

  @override
  Future<LocationPermission> checkPermission() async =>
      LocationPermission.whileInUse;

  @override
  Future<bool> isLocationServiceEnabled() async => true;

  @override
  Future<Position> getCurrentPosition(
      {LocationSettings? locationSettings}) async {
    readCount++;
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return _position();
  }
}
