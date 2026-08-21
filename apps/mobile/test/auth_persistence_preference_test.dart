import "package:flutter_test/flutter_test.dart";
import "package:shared_preferences/shared_preferences.dart";

import "package:the_eye_mobile/auth/auth_persistence_preference_store.dart";
import "package:the_eye_mobile/auth/auth_session_store.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test("Remain signed in defaults on and preserves a session on cold launch",
      () async {
    SharedPreferences.setMockInitialValues({});
    final preferences = await AuthPersistencePreferenceStore.create();
    final sessions = InMemoryAuthSessionStore();
    await sessions.save(
      const AuthSession(accessToken: "access", refreshToken: "refresh"),
    );

    expect(preferences.remainSignedIn, isTrue);
    await preferences.applyColdLaunchPolicy(sessions);
    expect((await sessions.load())?.accessToken, "access");
  });

  test("turning the preference off waits until the next cold launch", () async {
    SharedPreferences.setMockInitialValues({});
    final preferences = await AuthPersistencePreferenceStore.create();
    final sessions = InMemoryAuthSessionStore();
    await sessions.save(
      const AuthSession(accessToken: "access", refreshToken: "refresh"),
    );

    await preferences.setRemainSignedIn(false);
    expect(await sessions.load(), isNotNull);

    await preferences.applyColdLaunchPolicy(sessions);
    expect(await sessions.load(), isNull);
  });

  test("Remain signed in can be switched off and back on", () async {
    SharedPreferences.setMockInitialValues({});
    final preferences = await AuthPersistencePreferenceStore.create();

    await preferences.setRemainSignedIn(false);
    expect(preferences.remainSignedIn, isFalse);
    await preferences.setRemainSignedIn(true);
    expect(preferences.remainSignedIn, isTrue);
  });
}
