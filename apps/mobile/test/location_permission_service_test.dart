import "package:flutter_test/flutter_test.dart";
import "package:geolocator/geolocator.dart";
import "package:the_eye_mobile/location/location_permission_service.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group("locationFailureMessage", () {
    test("describes denied permission", () {
      expect(
        locationFailureMessage(LocationCaptureResult.denied),
        contains("Location permission is required"),
      );
    });

    test("describes permanently denied permission", () {
      expect(
        locationFailureMessage(LocationCaptureResult.deniedForever),
        contains("permanently denied"),
      );
    });

    test("describes disabled location services", () {
      expect(
        locationFailureMessage(LocationCaptureResult.serviceDisabled),
        contains("Turn on Location Services"),
      );
    });

    test("describes GPS timeout", () {
      expect(
        locationFailureMessage(LocationCaptureResult.timeout),
        contains("GPS fix"),
      );
    });
  });

  group("nearbyLocationNotice", () {
    test("describes denied permission for nearby police", () {
      expect(
        nearbyLocationNotice(LocationCaptureResult.denied),
        contains("nearest sorting"),
      );
    });
  });

  group("resolveLocationPermission", () {
    tearDown(() {
      GeolocatorPlatform.instance = GeolocatorPlatform.instance;
    });

    test("returns granted when permission already granted", () async {
      GeolocatorPlatform.instance = _FakeLocationPlatform(
        permission: LocationPermission.whileInUse,
      );
      expect(await resolveLocationPermission(), LocationCaptureResult.granted);
    });

    test("requests permission on first denied result", () async {
      final platform = _RequestingLocationPlatform(
        initialPermission: LocationPermission.denied,
        requestedPermission: LocationPermission.whileInUse,
      );
      GeolocatorPlatform.instance = platform;
      expect(await resolveLocationPermission(), LocationCaptureResult.granted);
      expect(platform.requestCount, 1);
    });

    test("returns denied when user declines request", () async {
      GeolocatorPlatform.instance = _FakeLocationPlatform(
        permission: LocationPermission.denied,
      );
      expect(await resolveLocationPermission(), LocationCaptureResult.denied);
    });

    test("returns deniedForever when permission blocked", () async {
      GeolocatorPlatform.instance = _FakeLocationPlatform(
        permission: LocationPermission.deniedForever,
      );
      expect(
        await resolveLocationPermission(),
        LocationCaptureResult.deniedForever,
      );
    });

    test("returns serviceDisabled when GPS is off", () async {
      GeolocatorPlatform.instance = _FakeLocationPlatform(
        permission: LocationPermission.whileInUse,
        serviceEnabled: false,
      );
      expect(
        await resolveLocationPermission(),
        LocationCaptureResult.serviceDisabled,
      );
    });

    test("does not request when requestIfDenied is false", () async {
      final platform = _RequestingLocationPlatform(
        initialPermission: LocationPermission.denied,
        requestedPermission: LocationPermission.whileInUse,
      );
      GeolocatorPlatform.instance = platform;
      expect(
        await resolveLocationPermission(requestIfDenied: false),
        LocationCaptureResult.denied,
      );
      expect(platform.requestCount, 0);
    });
  });

  group("captureLocationOutcome", () {
    tearDown(() {
      GeolocatorPlatform.instance = GeolocatorPlatform.instance;
    });

    test("returns position when permission granted and GPS available",
        () async {
      GeolocatorPlatform.instance = _FakeLocationPlatform(
        permission: LocationPermission.whileInUse,
      );
      final outcome = await captureLocationOutcome(
        timeout: const Duration(seconds: 1),
      );
      expect(outcome.result, LocationCaptureResult.granted);
      expect(outcome.position, isNotNull);
      expect(outcome.position!.latitude, 6.5244);
    });

    test("returns denied without hanging when permission declined", () async {
      GeolocatorPlatform.instance = _FakeLocationPlatform(
        permission: LocationPermission.denied,
      );
      final outcome = await captureLocationOutcome(
        timeout: const Duration(seconds: 1),
      );
      expect(outcome.result, LocationCaptureResult.denied);
      expect(outcome.position, isNull);
    });

    test("returns deniedForever without requesting position", () async {
      GeolocatorPlatform.instance = _FakeLocationPlatform(
        permission: LocationPermission.deniedForever,
      );
      final outcome = await captureLocationOutcome(
        timeout: const Duration(seconds: 1),
      );
      expect(outcome.result, LocationCaptureResult.deniedForever);
      expect(outcome.position, isNull);
    });

    test("returns serviceDisabled when location services are off", () async {
      GeolocatorPlatform.instance = _FakeLocationPlatform(
        permission: LocationPermission.whileInUse,
        serviceEnabled: false,
      );
      final outcome = await captureLocationOutcome(
        timeout: const Duration(seconds: 1),
      );
      expect(outcome.result, LocationCaptureResult.serviceDisabled);
      expect(outcome.position, isNull);
    });

    test("returns timeout when GPS read fails", () async {
      GeolocatorPlatform.instance = _FailingPositionPlatform();
      final outcome = await captureLocationOutcome(
        timeout: const Duration(seconds: 1),
      );
      expect(outcome.result, LocationCaptureResult.timeout);
      expect(outcome.position, isNull);
    });
  });
}

class _FakeLocationPlatform extends GeolocatorPlatform {
  _FakeLocationPlatform({
    required this.permission,
    this.serviceEnabled = true,
  });

  final LocationPermission permission;
  final bool serviceEnabled;

  @override
  Future<LocationPermission> checkPermission() async => permission;

  @override
  Future<LocationPermission> requestPermission() async => permission;

  @override
  Future<bool> isLocationServiceEnabled() async => serviceEnabled;

  @override
  Future<Position> getCurrentPosition(
      {LocationSettings? locationSettings}) async {
    return Position(
      latitude: 6.5244,
      longitude: 3.3792,
      timestamp: DateTime.now(),
      accuracy: 5,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );
  }
}

class _RequestingLocationPlatform extends GeolocatorPlatform {
  _RequestingLocationPlatform({
    required this.initialPermission,
    required this.requestedPermission,
  });

  final LocationPermission initialPermission;
  final LocationPermission requestedPermission;
  int requestCount = 0;

  @override
  Future<LocationPermission> checkPermission() async => initialPermission;

  @override
  Future<LocationPermission> requestPermission() async {
    requestCount++;
    return requestedPermission;
  }

  @override
  Future<bool> isLocationServiceEnabled() async => true;

  @override
  Future<Position> getCurrentPosition(
      {LocationSettings? locationSettings}) async {
    return Position(
      latitude: 6.5244,
      longitude: 3.3792,
      timestamp: DateTime.now(),
      accuracy: 5,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );
  }
}

class _FailingPositionPlatform extends GeolocatorPlatform {
  @override
  Future<LocationPermission> checkPermission() async =>
      LocationPermission.whileInUse;

  @override
  Future<LocationPermission> requestPermission() async =>
      LocationPermission.whileInUse;

  @override
  Future<bool> isLocationServiceEnabled() async => true;

  @override
  Future<Position> getCurrentPosition(
      {LocationSettings? locationSettings}) async {
    throw Exception("GPS unavailable");
  }
}
