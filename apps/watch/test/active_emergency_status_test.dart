import "package:flutter_test/flutter_test.dart";
import "package:the_eye_watch/models/active_emergency_status.dart";
import "package:the_eye_watch/models/emergency_mode.dart";
import "package:the_eye_watch/models/sos_event.dart";

void main() {
  test("maps verified incident status to awaiting assignment", () {
    expect(watchIncidentStatusLabel("Verified"), "Awaiting assignment");
  });

  test("detects terminal incident statuses", () {
    expect(watchIncidentTerminal("Resolved"), isTrue);
    expect(watchIncidentTerminal("Assigned"), isFalse);
  });

  test("uses factual operational copy without fake help messaging", () {
    final state = SosEventState(
      lifecycle: SosLifecycle.active,
      incidentId: "inc-1",
      incidentStatus: "Verified",
    );
    expect(watchOperationalBody(state), "Awaiting assignment");
  });

  test("silent mode is represented discreetly in emergency mode enum", () {
    expect(WatchEmergencyMode.silentSos.apiValue, "SilentSOS");
  });
}
