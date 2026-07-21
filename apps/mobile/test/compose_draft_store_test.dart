import "package:flutter_test/flutter_test.dart";
import "package:geolocator/geolocator.dart";
import "package:shared_preferences/shared_preferences.dart";

import "package:the_eye_mobile/incidents/compose_draft_store.dart";
import "package:the_eye_mobile/incidents/incident_draft_factory.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test("compose draft store persists and deletes drafts", () async {
    SharedPreferences.setMockInitialValues({});
    final store = ComposeDraftStore();
    final draft = buildIncidentDraft(
      type: "Crime",
      description: "Draft crime report saved before submit.",
      position: Position(
        latitude: 6.6018,
        longitude: 3.3515,
        timestamp: DateTime.utc(2026, 7, 22),
        accuracy: 12,
        altitude: 0,
        altitudeAccuracy: 0,
        heading: 0,
        headingAccuracy: 0,
        speed: 0,
        speedAccuracy: 0,
      ),
      clientSubmissionId: "compose-draft-1",
    );

    await store.upsertDraft(draft);
    expect((await store.loadDrafts()).single.clientSubmissionId, "compose-draft-1");

    await store.deleteDraft("compose-draft-1");
    expect(await store.loadDrafts(), isEmpty);
  });
}
