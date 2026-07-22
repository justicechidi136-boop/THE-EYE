import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/emergency/active_emergency_store.dart";

void main() {
  test("ActiveEmergencySnapshot reads silent flag from metadata", () {
    final snapshot = ActiveEmergencySnapshot.fromJson({
      "id": "inc-1",
      "status": "Submitted",
      "title": "Silent SOS",
      "type": "SOS",
      "metadata": {"silent": true},
      "timeline": [],
    });
    expect(snapshot.silent, isTrue);
  });
}
