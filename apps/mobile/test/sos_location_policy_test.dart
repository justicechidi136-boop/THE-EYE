import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:the_eye_mobile/location/location_permission_service.dart';

void main() {
  test('buildSos metadata marks pending when no fix', () {
    const access = LocationAccessResult(
      state: LocationPermissionState.timedOut,
    );
    expect(locationMetadataFields(access)['locationStatus'], 'pending');
    expect(locationMetadataFields(access)['locationSource'], 'unavailable');
  });

  test('buildSos metadata marks cached fix', () {
    final access = LocationAccessResult(
      state: LocationPermissionState.grantedPrecise,
      position: Position(
        latitude: 6.5,
        longitude: 3.3,
        timestamp: DateTime.now(),
        accuracy: 12,
        altitude: 0,
        altitudeAccuracy: 0,
        heading: 0,
        headingAccuracy: 0,
        speed: 0,
        speedAccuracy: 0,
      ),
      source: LocationSource.cachedMobile,
      isCached: true,
      ageSeconds: 42,
    );
    expect(locationMetadataFields(access)['locationStatus'], 'cached');
    expect(locationMetadataFields(access)['isCached'], isTrue);
    expect(locationMetadataFields(access)['ageSeconds'], 42);
  });

  test('sosLocationUserMessage explains pending submission', () {
    expect(
      sosLocationUserMessage(
        const LocationAccessResult(state: LocationPermissionState.timedOut),
        submitted: true,
      ),
      contains('not available yet'),
    );
  });
}
