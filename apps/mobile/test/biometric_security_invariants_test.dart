import "dart:io";

import "package:flutter_test/flutter_test.dart";

void main() {
  test("biometric preferences contain no password or biometric material", () {
    final source =
        File("lib/auth/biometric_preference_store.dart").readAsStringSync();

    expect(source.toLowerCase().contains("password"), isFalse);
    expect(source.contains("accountIdKey"), isTrue);
    expect(source.contains("FlutterSecureStorage"), isTrue);
  });

  test("native biometric platform requirements remain configured", () {
    final manifest =
        File("android/app/src/main/AndroidManifest.xml").readAsStringSync();
    final activity = File(
      "android/app/src/main/kotlin/com/theeye/app/MainActivity.kt",
    ).readAsStringSync();
    final infoPlist = File("ios/Runner/Info.plist").readAsStringSync();

    expect(manifest.contains("android.permission.USE_BIOMETRIC"), isTrue);
    expect(activity.contains("FlutterFragmentActivity"), isTrue);
    expect(infoPlist.contains("NSFaceIDUsageDescription"), isTrue);
  });

  test("explicit logout clears biometric binding", () {
    final source = File("lib/main.dart").readAsStringSync();
    final logoutStart = source.indexOf("Future<void> clearSession() async");
    final logoutEnd = source.indexOf(
      "Future<void> loadCommunitiesFromApi",
      logoutStart,
    );
    final logout = source.substring(logoutStart, logoutEnd);

    expect(logout.contains("disableBiometricUnlock"), isTrue);
    expect(logout.contains("_authService.logout"), isTrue);
  });

  test("biometric opt-in is presented in Settings Security", () {
    final source = File("lib/main.dart").readAsStringSync();

    expect(source.contains('title: "Security"'), isTrue);
    expect(source.contains("const _BiometricUnlockSettingsTile()"), isTrue);
  });
}
