import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/incidents/incident_draft.dart";
import "package:the_eye_mobile/incidents/incident_draft_factory.dart";
import "package:the_eye_mobile/contracts/the_eye_payloads.dart";

void main() {
  test("silent SOS draft serializes emergency category for replay", () {
    final draft = IncidentDraft(
      clientSubmissionId: createClientSubmissionId(),
      type: "SOS",
      description: "Discreet assistance request from mobile app.",
      latitude: 6.5,
      longitude: 3.3,
      capturedAt: DateTime.parse("2026-07-22T10:00:00Z"),
      silent: true,
      emergencyCategory: "SilentSos",
      notifyEmergencyContacts: false,
    );

    final restored = IncidentDraft.fromJson(draft.toJson());
    expect(restored.silent, isTrue);
    expect(restored.emergencyCategory, "SilentSos");

    final payload = TheEyePayloads.reportSos(
      emergencyCategory: restored.emergencyCategory!,
      latitude: restored.latitude,
      longitude: restored.longitude,
      description: restored.description,
      silent: restored.silent,
    );
    expect(payload["silent"], isTrue);
    expect(payload["emergencyCategory"], "SilentSos");
  });
}
