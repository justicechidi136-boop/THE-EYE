import "package:flutter_test/flutter_test.dart";
import "package:shared_preferences/shared_preferences.dart";

import "package:the_eye_mobile/broadcasts/stolen_vehicle_broadcast_draft_store.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test("stolen vehicle draft store persists and clears scoped draft", () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final store = StolenVehicleBroadcastDraftStore(preferences: prefs);
    const draft = StolenVehicleBroadcastDraft(
      entryMode: "manualEntry",
      selectedVehicleId: "vehicle-2",
      usedSavedVehicle: true,
      plateNumber: "ABC-123",
      make: "Toyota",
      model: "Corolla",
      year: "2022",
      color: "Red",
      vin: "VIN1234",
      description: "Rear bumper damage",
    );

    await store.save(userScope: "user-a", draft: draft);
    final loaded = await store.load(userScope: "user-a");
    expect(loaded?.entryMode, "manualEntry");
    expect(loaded?.selectedVehicleId, "vehicle-2");
    expect(loaded?.plateNumber, "ABC-123");
    expect(await store.load(userScope: "user-b"), isNull);

    await store.clear(userScope: "user-a");
    expect(await store.load(userScope: "user-a"), isNull);
  });
}
