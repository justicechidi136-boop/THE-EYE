import "package:shared_preferences/shared_preferences.dart";

class AuthSession {
  const AuthSession({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;
}

class AuthExchangeResult {
  const AuthExchangeResult({
    required this.session,
    required this.profileComplete,
  });

  final AuthSession session;
  final bool profileComplete;
}

abstract class AuthSessionStore {
  Future<AuthSession?> load();
  Future<void> save(AuthSession session);
  Future<void> clear();
}

class SharedPreferencesAuthSessionStore implements AuthSessionStore {
  SharedPreferencesAuthSessionStore(this._preferences);

  static const accessTokenKey = "the_eye_access_token";
  static const refreshTokenKey = "the_eye_refresh_token";

  final SharedPreferences _preferences;

  static Future<SharedPreferencesAuthSessionStore> create() async {
    return SharedPreferencesAuthSessionStore(
        await SharedPreferences.getInstance());
  }

  @override
  Future<AuthSession?> load() async {
    final accessToken = _preferences.getString(accessTokenKey);
    final refreshToken = _preferences.getString(refreshTokenKey);
    if (accessToken == null ||
        accessToken.isEmpty ||
        refreshToken == null ||
        refreshToken.isEmpty) {
      return null;
    }
    return AuthSession(accessToken: accessToken, refreshToken: refreshToken);
  }

  @override
  Future<void> save(AuthSession session) async {
    await _preferences.setString(accessTokenKey, session.accessToken);
    await _preferences.setString(refreshTokenKey, session.refreshToken);
  }

  @override
  Future<void> clear() async {
    await _preferences.remove(accessTokenKey);
    await _preferences.remove(refreshTokenKey);
  }
}

class InMemoryAuthSessionStore implements AuthSessionStore {
  AuthSession? session;

  @override
  Future<AuthSession?> load() async => session;

  @override
  Future<void> save(AuthSession value) async {
    session = value;
  }

  @override
  Future<void> clear() async {
    session = null;
  }
}
