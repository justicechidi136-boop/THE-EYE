import "dart:convert";

import "package:flutter_secure_storage/flutter_secure_storage.dart";
import "package:flutter_test/flutter_test.dart";
import "package:shared_preferences/shared_preferences.dart";
import "package:the_eye_mobile/auth/auth_session_store.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
  });

  test("saves rotated access and refresh credentials in one envelope",
      () async {
    const secureStorage = FlutterSecureStorage();
    final store = SecureAuthSessionStore(
      secureStorage: secureStorage,
      legacyPreferences: await SharedPreferences.getInstance(),
    );

    await store.save(const AuthSession(
      accessToken: "new-access",
      refreshToken: "new-refresh",
    ));

    final envelope = await secureStorage.read(
      key: SecureAuthSessionStore.sessionEnvelopeKey,
    );
    expect(jsonDecode(envelope!), {
      "accessToken": "new-access",
      "refreshToken": "new-refresh",
    });
    expect(
      await secureStorage.read(key: SecureAuthSessionStore.accessTokenKey),
      isNull,
    );
    expect(
      await secureStorage.read(key: SecureAuthSessionStore.refreshTokenKey),
      isNull,
    );
  });

  test("migrates split secure-storage credentials into the envelope", () async {
    FlutterSecureStorage.setMockInitialValues({
      SecureAuthSessionStore.accessTokenKey: "legacy-access",
      SecureAuthSessionStore.refreshTokenKey: "legacy-refresh",
    });
    const secureStorage = FlutterSecureStorage();
    final store = SecureAuthSessionStore(
      secureStorage: secureStorage,
      legacyPreferences: await SharedPreferences.getInstance(),
    );

    final session = await store.load();

    expect(session?.accessToken, "legacy-access");
    expect(session?.refreshToken, "legacy-refresh");
    expect(
      await secureStorage.read(key: SecureAuthSessionStore.sessionEnvelopeKey),
      isNotNull,
    );
  });

  test("clear removes envelope and all legacy credential keys", () async {
    FlutterSecureStorage.setMockInitialValues({
      SecureAuthSessionStore.sessionEnvelopeKey: jsonEncode({
        "accessToken": "access",
        "refreshToken": "refresh",
      }),
      SecureAuthSessionStore.accessTokenKey: "old-access",
      SecureAuthSessionStore.refreshTokenKey: "old-refresh",
    });
    const secureStorage = FlutterSecureStorage();
    final store = SecureAuthSessionStore(
      secureStorage: secureStorage,
      legacyPreferences: await SharedPreferences.getInstance(),
    );

    await store.clear();

    expect(await store.load(), isNull);
  });
}
