import "package:flutter_test/flutter_test.dart";
import "package:geolocator/geolocator.dart";
import "package:the_eye_mobile/location/device_location_service.dart";
import "package:the_eye_mobile/location/device_location_state.dart";
import "package:the_eye_mobile/location/location_permission_service.dart";
import "package:the_eye_mobile/location/location_reverse_geocode.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group("DeviceLocationState", () {
    test("labels cached GPS separately from profile jurisdiction", () {
      const state = DeviceLocationState(
        status: DeviceLocationStatus.cached,
        latitude: 4.8156,
        longitude: 7.0498,
        locality: "Port Harcourt",
        state: "Rivers State",
        source: DeviceLocationSourceKind.cachedDevice,
        isCached: true,
        ageSeconds: 420,
      );
      expect(state.headlineLabel, "Last known device location");
      expect(state.displayLocality, contains("Port Harcourt"));
      expect(state.sourceLabel, "Cached device location");
    });

    test("does not substitute fallback city when GPS unavailable", () {
      const state = DeviceLocationState(
        status: DeviceLocationStatus.unavailable,
      );
      expect(state.displayLocality, "Current device location is unavailable.");
    });

    test("danger speech prefers street, then landmark, and never city", () {
      const street = DeviceLocationState(
        status: DeviceLocationStatus.acquired,
        street: "Allen Avenue",
        subLocality: "Computer Village",
        locality: "Ikeja",
        state: "Lagos",
      );
      const landmark = DeviceLocationState(
        status: DeviceLocationStatus.acquired,
        subLocality: "Computer Village",
        locality: "Ikeja",
        state: "Lagos",
      );
      const cityOnly = DeviceLocationState(
        status: DeviceLocationStatus.acquired,
        subLocality: "Ikeja",
        locality: "Ikeja",
        state: "Lagos",
      );

      expect(street.dangerSpokenLocation, "Allen Avenue");
      expect(landmark.dangerSpokenLocation, "Computer Village");
      expect(cityOnly.dangerSpokenLocation, "the reported location");
    });

    test("profile jurisdiction display is explicit", () {
      const profile = ProfileJurisdictionDisplay(
        lga: "Ikeja",
        state: "Lagos",
        country: "Nigeria",
      );
      expect(profile.label, "Ikeja, Lagos, Nigeria");
    });
  });

  group("DeviceLocationService", () {
    tearDown(resetSharedEmergencyLocationCoordinator);

    test("suppresses duplicate probe calls while one is active", () async {
      final platform = _PortHarcourtLocationPlatform();
      final geocoder = _PortHarcourtGeocoder();
      final service = DeviceLocationService(
        geolocator: platform,
        reverseGeocoder: geocoder,
      );

      final first = service.probeCurrentLocation(
        timeout: const Duration(seconds: 2),
      );
      final second = service.probeCurrentLocation(
        timeout: const Duration(seconds: 2),
      );
      expect(identical(await first, await second), isTrue);
      expect(platform.readCount, 1);
    });

    test("returns fresh Port Harcourt fix with reverse geocode labels",
        () async {
      resetSharedEmergencyLocationCoordinator();
      final platform = _PortHarcourtLocationPlatform();
      final service = DeviceLocationService(
        geolocator: platform,
        reverseGeocoder: _PortHarcourtGeocoder(),
      );

      final result = await service.probeCurrentLocation(
        timeout: const Duration(seconds: 2),
      );

      expect(result.status, DeviceLocationStatus.acquired);
      expect(result.displayLocality, "Port Harcourt, Rivers State");
      expect(result.source, DeviceLocationSourceKind.freshGps);
      expect(result.isProfileFallback, isFalse);
      expect(result.isJurisdictionFallback, isFalse);
    });

    test("returns denied without hanging", () async {
      resetSharedEmergencyLocationCoordinator();
      final service = DeviceLocationService(
        geolocator: _DeniedLocationPlatform(),
        reverseGeocoder: const _EmptyGeocoder(),
      );

      final result = await service.probeCurrentLocation(
        timeout: const Duration(seconds: 1),
      );

      expect(result.status, DeviceLocationStatus.denied);
      expect(result.message, contains("Location access is off"));
    });

    test("returns serviceDisabled when GPS is off", () async {
      resetSharedEmergencyLocationCoordinator();
      final service = DeviceLocationService(
        geolocator: _ServiceDisabledPlatform(),
        reverseGeocoder: const _EmptyGeocoder(),
      );

      final result = await service.probeCurrentLocation(
        timeout: const Duration(seconds: 1),
      );

      expect(result.status, DeviceLocationStatus.serviceDisabled);
    });

    test("keeps GPS fix when reverse geocode fails", () async {
      resetSharedEmergencyLocationCoordinator();
      final service = DeviceLocationService(
        geolocator: _PortHarcourtLocationPlatform(),
        reverseGeocoder: const _EmptyGeocoder(),
      );

      final result = await service.probeCurrentLocation(
        timeout: const Duration(seconds: 2),
      );

      expect(result.hasCoordinates, isTrue);
      expect(result.displayLocality, "Location acquired (address unavailable)");
      expect(result.errorCode, LocationTestErrorCode.reverseGeocodeFailed);
    });
  });

  group("CachedLocationReverseGeocoder", () {
    test("deduplicates nearby lookups within the cache lifetime", () async {
      final delegate = _CountingGeocoder();
      final cache = CachedLocationReverseGeocoder(delegate: delegate);

      final first = cache.lookup(latitude: 4.81561, longitude: 7.04981);
      final second = cache.lookup(latitude: 4.81562, longitude: 7.04982);
      final results = await Future.wait([first, second]);

      expect(results.every((result) => result.locality == "Port Harcourt"),
          isTrue);
      expect(delegate.calls, 1);
    });
  });
}

class _CountingGeocoder implements LocationReverseGeocoder {
  int calls = 0;

  @override
  Future<ReverseGeocodeResult> lookup({
    required double latitude,
    required double longitude,
  }) async {
    calls += 1;
    await Future<void>.delayed(const Duration(milliseconds: 10));
    return const ReverseGeocodeResult(
      locality: "Port Harcourt",
      state: "Rivers State",
    );
  }
}

class _PortHarcourtGeocoder implements LocationReverseGeocoder {
  @override
  Future<ReverseGeocodeResult> lookup({
    required double latitude,
    required double longitude,
  }) async {
    return const ReverseGeocodeResult(
      locality: "Port Harcourt",
      state: "Rivers State",
      country: "Nigeria",
    );
  }
}

class _EmptyGeocoder implements LocationReverseGeocoder {
  const _EmptyGeocoder();

  @override
  Future<ReverseGeocodeResult> lookup({
    required double latitude,
    required double longitude,
  }) async {
    return const ReverseGeocodeResult();
  }
}

class _PortHarcourtLocationPlatform extends GeolocatorPlatform {
  int readCount = 0;

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
    readCount += 1;
    await Future<void>.delayed(const Duration(milliseconds: 50));
    return Position(
      latitude: 4.8156,
      longitude: 7.0498,
      timestamp: DateTime.now(),
      accuracy: 18,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );
  }
}

class _DeniedLocationPlatform extends GeolocatorPlatform {
  @override
  Future<LocationPermission> checkPermission() async =>
      LocationPermission.denied;

  @override
  Future<LocationPermission> requestPermission() async =>
      LocationPermission.denied;

  @override
  Future<bool> isLocationServiceEnabled() async => true;
}

class _ServiceDisabledPlatform extends GeolocatorPlatform {
  @override
  Future<LocationPermission> checkPermission() async =>
      LocationPermission.whileInUse;

  @override
  Future<LocationPermission> requestPermission() async =>
      LocationPermission.whileInUse;

  @override
  Future<bool> isLocationServiceEnabled() async => false;
}
