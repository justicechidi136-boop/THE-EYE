import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureSessionStore {
  SecureSessionStore({
    FlutterSecureStorage? secureStorage,
    Map<String, String>? memory,
  })  : _secure = secureStorage ?? const FlutterSecureStorage(),
        _memory = memory;

  static const _accessTokenKey = 'field.access_token';
  static const _refreshTokenKey = 'field.refresh_token';
  static const _sessionIdKey = 'field.session_id';
  static const _publicDeviceIdKey = 'field.public_device_id';
  static const _installationIdKey = 'field.installation_id';
  static const _officerIdKey = 'field.officer_id';
  static const _officerNameKey = 'field.officer_name';
  static const _lockedKey = 'field.session_locked';

  final FlutterSecureStorage _secure;
  final Map<String, String>? _memory;

  Future<String?> readAccessToken() => _read(_accessTokenKey);
  Future<String?> readRefreshToken() => _read(_refreshTokenKey);
  Future<String?> readSessionId() => _read(_sessionIdKey);
  Future<String?> readPublicDeviceId() => _read(_publicDeviceIdKey);
  Future<String?> readInstallationId() => _read(_installationIdKey);
  Future<String?> readOfficerId() => _read(_officerIdKey);
  Future<String?> readOfficerName() => _read(_officerNameKey);

  Future<bool> isLocked() async {
    final value = await _read(_lockedKey);
    return value == 'true';
  }

  Future<void> saveInstallationId(String installationId) =>
      _write(_installationIdKey, installationId);

  Future<void> savePublicDeviceId(String publicDeviceId) =>
      _write(_publicDeviceIdKey, publicDeviceId);

  Future<void> saveSession({
    required String accessToken,
    required String refreshToken,
    required String sessionId,
    required String publicDeviceId,
    String? officerId,
    String? officerName,
  }) async {
    await _write(_accessTokenKey, accessToken);
    await _write(_refreshTokenKey, refreshToken);
    await _write(_sessionIdKey, sessionId);
    await _write(_publicDeviceIdKey, publicDeviceId);
    await _write(_lockedKey, 'false');
    if (officerId != null && officerId.isNotEmpty) {
      await _write(_officerIdKey, officerId);
    }
    if (officerName != null && officerName.isNotEmpty) {
      await _write(_officerNameKey, officerName);
    }
  }

  Future<void> saveAccessToken(String accessToken) =>
      _write(_accessTokenKey, accessToken);

  Future<void> setLocked(bool locked) =>
      _write(_lockedKey, locked ? 'true' : 'false');

  Future<void> clearSession() async {
    await _delete(_accessTokenKey);
    await _delete(_refreshTokenKey);
    await _delete(_sessionIdKey);
    await _delete(_officerIdKey);
    await _delete(_officerNameKey);
    await _delete(_lockedKey);
  }

  Future<void> wipeAll() async {
    if (_memory != null) {
      _memory.clear();
      return;
    }
    await _secure.deleteAll();
  }

  Future<String?> _read(String key) async {
    if (_memory != null) return _memory[key];
    return _secure.read(key: key);
  }

  Future<void> _write(String key, String value) async {
    if (_memory != null) {
      _memory[key] = value;
      return;
    }
    await _secure.write(key: key, value: value);
  }

  Future<void> _delete(String key) async {
    if (_memory != null) {
      _memory.remove(key);
      return;
    }
    await _secure.delete(key: key);
  }
}
