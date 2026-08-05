import "package:flutter_test/flutter_test.dart";
import "package:shared_preferences/shared_preferences.dart";

import "package:the_eye_mobile/emergency/active_emergency_store.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test("ActiveEmergencyStore preserves silent flag per incident", () async {
    final store = ActiveEmergencyStore();
    await store.activateIncident("inc-1", silent: true);
    expect(await store.readSilentModeFor("inc-1"), isTrue);
    expect(await store.readSilentModeFor("inc-2"), isFalse);
  });
}
