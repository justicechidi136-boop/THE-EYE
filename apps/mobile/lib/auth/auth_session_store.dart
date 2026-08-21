import "package:flutter_secure_storage/flutter_secure_storage.dart";
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

class SecureAuthSessionStore implements AuthSessionStore {
  SecureAuthSessionStore({
    required FlutterSecureStorage secureStorage,
    required SharedPreferences legacyPreferences,
  })  : _secureStorage = secureStorage,
        _legacyPreferences = legacyPreferences;

  static const accessTokenKey = "the_eye_access_token";
  static const refreshTokenKey = "the_eye_refresh_token";

  final FlutterSecureStorage _secureStorage;
  final SharedPreferences _legacyPreferences;

  static Future<SecureAuthSessionStore> create() async {
    return SecureAuthSessionStore(
      secureStorage: const FlutterSecureStorage(),
      legacyPreferences: await SharedPreferences.getInstance(),
    );
  }

  @override
  Future<AuthSession?> load() async {
    var accessToken = await _secureStorage.read(key: accessTokenKey);
    var refreshToken = await _secureStorage.read(key: refreshTokenKey);
    if ((accessToken == null || refreshToken == null) &&
        _legacyPreferences.containsKey(accessTokenKey)) {
      accessToken = _legacyPreferences.getString(accessTokenKey);
      refreshToken = _legacyPreferences.getString(refreshTokenKey);
      if (accessToken != null &&
          accessToken.isNotEmpty &&
          refreshToken != null &&
          refreshToken.isNotEmpty) {
        await save(
          AuthSession(accessToken: accessToken, refreshToken: refreshToken),
        );
      }
      await _clearLegacyValues();
    }
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
    await _secureStorage.write(
      key: accessTokenKey,
      value: session.accessToken,
    );
    await _secureStorage.write(
      key: refreshTokenKey,
      value: session.refreshToken,
    );
    await _clearLegacyValues();
  }

  @override
  Future<void> clear() async {
    await _secureStorage.delete(key: accessTokenKey);
    await _secureStorage.delete(key: refreshTokenKey);
    await _clearLegacyValues();
  }

  Future<void> _clearLegacyValues() async {
    await _legacyPreferences.remove(accessTokenKey);
    await _legacyPreferences.remove(refreshTokenKey);
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
