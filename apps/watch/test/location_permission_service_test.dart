import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:the_eye_watch/location/location_permission_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('resolveWatchLocationPermissionState', () {
    tearDown(() {
      GeolocatorPlatform.instance = GeolocatorPlatform.instance;
    });

    test('returns denied when user declines', () async {
      GeolocatorPlatform.instance = _FakeWatchPlatform(
        permission: LocationPermission.denied,
      );
      expect(
        await resolveWatchLocationPermissionState(),
        WatchLocationPermissionState.denied,
      );
    });

    test('returns serviceDisabled when GPS is off', () async {
      GeolocatorPlatform.instance = _FakeWatchPlatform(
        permission: LocationPermission.whileInUse,
        serviceEnabled: false,
      );
      expect(
        await resolveWatchLocationPermissionState(),
        WatchLocationPermissionState.serviceDisabled,
      );
    });
  });

  group('resolveWatchLocationAccess', () {
    tearDown(() {
      GeolocatorPlatform.instance = GeolocatorPlatform.instance;
    });

    test('returns watch GPS when granted', () async {
      GeolocatorPlatform.instance = _FakeWatchPlatform(
        permission: LocationPermission.whileInUse,
      );
      final access = await resolveWatchLocationAccess(
        timeout: const Duration(seconds: 1),
      );
      expect(access.hasFix, isTrue);
      expect(access.source, WatchLocationSource.watchGps);
    });

    test('returns pending metadata when GPS unavailable', () async {
      GeolocatorPlatform.instance = _FailingWatchPlatform();
      final access = await resolveWatchLocationAccess(
        timeout: const Duration(seconds: 1),
        allowCachedFallback: false,
      );
      expect(access.hasFix, isFalse);
      expect(
        watchLocationMetadataFields(access)['locationStatus'],
        'pending',
      );
    });
  });

  test('watchSosLocationMessage reports pending submission', () {
    expect(
      watchSosLocationMessage(
        const WatchLocationAccessResult(
          state: WatchLocationPermissionState.timedOut,
        ),
        submitted: true,
      ),
      'SOS sent. Location pending.',
    );
  });
}

class _FakeWatchPlatform extends GeolocatorPlatform {
  _FakeWatchPlatform({
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
      accuracy: 8,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );
  }
}

class _FailingWatchPlatform extends GeolocatorPlatform {
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
    throw Exception('GPS unavailable');
  }
}
