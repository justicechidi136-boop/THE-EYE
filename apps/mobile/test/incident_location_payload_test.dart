import "package:flutter_test/flutter_test.dart";
import "package:geolocator/geolocator.dart";
import "package:the_eye_mobile/contracts/the_eye_payloads.dart";

void main() {
  test("incidentLocationUpdate includes sequence and accuracy fields", () {
    final position = Position(
      latitude: 6.6012,
      longitude: 3.3514,
      timestamp: DateTime.utc(2026, 7, 22, 12, 0),
      accuracy: 8,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );

    final payload = TheEyePayloads.incidentLocationUpdate(
      position: position,
      sequenceNumber: 3,
    );

    expect(payload["sequenceNumber"], 3);
    expect(payload["accuracyMeters"], 8);
    expect(payload["latitude"], 6.6012);
    expect(payload["sourceDeviceId"], "mobile-primary");
  });
}
