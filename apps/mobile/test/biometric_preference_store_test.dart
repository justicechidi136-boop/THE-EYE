import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/auth/biometric_preference_store.dart";

void main() {
  test("biometric unlock is opt-in and account-bound", () async {
    final store = InMemoryBiometricPreferenceStore();

    expect((await store.load()).enabled, isFalse);
    await store.enableForAccount("citizen-1");

    final enabled = await store.load();
    expect(enabled.hasAccountBinding, isTrue);
    expect(enabled.accountId, "citizen-1");
  });

  test("clearing preference removes enablement and account binding", () async {
    final store = InMemoryBiometricPreferenceStore();
    await store.enableForAccount("citizen-1");

    await store.clear();

    final cleared = await store.load();
    expect(cleared.enabled, isFalse);
    expect(cleared.accountId, isNull);
  });

  test("empty account identifiers cannot enable biometric unlock", () async {
    final store = InMemoryBiometricPreferenceStore();

    expect(
      () => store.enableForAccount(" "),
      throwsArgumentError,
    );
  });
}
