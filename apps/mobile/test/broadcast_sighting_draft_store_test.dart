import "package:flutter_test/flutter_test.dart";
import "package:shared_preferences/shared_preferences.dart";

import "package:the_eye_mobile/broadcasts/broadcast_sighting_draft_store.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test("sighting draft store persists and clears securely scoped drafts",
      () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final store = BroadcastSightingDraftStore(preferences: prefs);
    const draft = BroadcastSightingDraft(
      broadcastId: "b1",
      clientActionId: "action-1",
      description: "Seen heading north.",
      latitude: 6.5,
      longitude: 3.4,
      approximateArea: "Near Ikeja",
      confidence: "ReporterProvided",
    );

    await store.save(userScope: "user-a", draft: draft);
    final loaded = await store.load(userScope: "user-a", broadcastId: "b1");
    expect(loaded?.clientActionId, "action-1");
    expect(loaded?.description, "Seen heading north.");
    expect(loaded?.latitude, 6.5);
    expect(await store.load(userScope: "user-b", broadcastId: "b1"), isNull);

    await store.clear(userScope: "user-a", broadcastId: "b1");
    expect(await store.load(userScope: "user-a", broadcastId: "b1"), isNull);
  });
}
