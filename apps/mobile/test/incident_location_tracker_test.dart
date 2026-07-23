import "package:flutter_test/flutter_test.dart";
import "package:geolocator/geolocator.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/incidents/incident_location_tracker.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  tearDown(() {
    GeolocatorPlatform.instance = GeolocatorPlatform.instance;
  });

  test("tracker skips updates when permission is denied", () async {
    GeolocatorPlatform.instance = _DeniedPermissionPlatform();
    final tracker = IncidentLocationTracker(
      apiClient: _NoOpApiClient(),
    );
    tracker.start(incidentId: "inc-1", accessToken: "token");
    await Future<void>.delayed(Duration.zero);
    expect(tracker.isTracking, isTrue);
    tracker.stop();
  });
}

class _DeniedPermissionPlatform extends GeolocatorPlatform {
  @override
  Future<LocationPermission> checkPermission() async =>
      LocationPermission.denied;

  @override
  Future<bool> isLocationServiceEnabled() async => true;
}

class _NoOpApiClient extends TheEyeApiClient {
  _NoOpApiClient() : super(baseUrl: "http://localhost:4000/v1");

  @override
  Future<void> postIncidentLocation({
    required String incidentId,
    required Map<String, dynamic> payload,
    String? accessToken,
  }) async {
    fail("postIncidentLocation should not run without permission");
  }
}
