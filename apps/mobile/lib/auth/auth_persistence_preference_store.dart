import "package:shared_preferences/shared_preferences.dart";

import "auth_session_store.dart";

class AuthPersistencePreferenceStore {
  AuthPersistencePreferenceStore(this._preferences);

  static const remainSignedInKey = "auth_remain_signed_in";

  final SharedPreferences _preferences;

  static Future<AuthPersistencePreferenceStore> create() async {
    return AuthPersistencePreferenceStore(
      await SharedPreferences.getInstance(),
    );
  }

  bool get remainSignedIn =>
      _preferences.getBool(remainSignedInKey) ?? true;

  Future<void> setRemainSignedIn(bool value) async {
    await _preferences.setBool(remainSignedInKey, value);
  }

  Future<void> applyColdLaunchPolicy(AuthSessionStore sessionStore) async {
    if (!remainSignedIn) {
      await sessionStore.clear();
    }
  }
}
