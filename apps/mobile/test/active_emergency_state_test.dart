import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/emergency/active_emergency_state.dart";

void main() {
  test("maps submitted status to submitted phase", () {
    expect(
        mapIncidentStatusToPhase("Submitted"), ActiveEmergencyPhase.submitted);
  });

  test("maps verified status to awaiting assignment", () {
    expect(mapIncidentStatusToPhase("Verified"),
        ActiveEmergencyPhase.awaitingAssignment);
  });

  test("does not allow cancellation after responding", () {
    expect(phaseAllowsCancellation(ActiveEmergencyPhase.responderEnRoute),
        isFalse);
    expect(phaseAllowsCancellation(ActiveEmergencyPhase.assigned), isTrue);
  });

  test("offline queue maps to failedOffline", () {
    expect(
      mapIncidentStatusToPhase("Submitted", offlineQueued: true),
      ActiveEmergencyPhase.failedOffline,
    );
  });
}
