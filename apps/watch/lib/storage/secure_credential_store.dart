import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/alert.dart';
import '../models/offline_event.dart';

class SecureCredentialStore {
  SecureCredentialStore({
    FlutterSecureStorage? secureStorage,
    Map<String, String>? memory,
  })  : _secure = secureStorage ?? const FlutterSecureStorage(),
        _memory = memory;

  final FlutterSecureStorage _secure;
  final Map<String, String>? _memory;

  static const _deviceIdKey = 'watch.device_id';
  static const _deviceSecretKey = 'watch.device_secret';
  static const _accessTokenKey = 'watch.access_token';
  static const _pushTokenKey = 'watch.push_token';

  Future<String?> readDeviceId() => _read(_deviceIdKey);

  Future<String?> readDeviceSecret() => _read(_deviceSecretKey);

  Future<String?> readAccessToken() => _read(_accessTokenKey);

  Future<String?> readPushToken() => _read(_pushTokenKey);

  Future<void> saveDeviceCredentials({
    required String deviceId,
    required String deviceSecret,
  }) async {
    await _write(_deviceIdKey, deviceId);
    await _write(_deviceSecretKey, deviceSecret);
  }

  Future<void> saveAccessToken(String? token) async {
    if (token == null || token.isEmpty) {
      await _delete(_accessTokenKey);
      return;
    }
    await _write(_accessTokenKey, token);
  }

  Future<void> savePushToken(String? token) async {
    if (token == null || token.isEmpty) {
      await _delete(_pushTokenKey);
      return;
    }
    await _write(_pushTokenKey, token);
  }

  Future<void> wipe() async {
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

class PreferencesStore {
  PreferencesStore({SharedPreferences? preferences})
      : _preferences = preferences;

  SharedPreferences? _preferences;

  Future<SharedPreferences> get prefs async =>
      _preferences ??= await SharedPreferences.getInstance();

  static const _offlineQueueKey = 'watch.offline_queue';
  static const _alertsKey = 'watch.alert_history';
  static const _pairingCodeKey = 'watch.pairing_code';
  static const _isPairedKey = 'watch.is_paired';
  static const _launcherOnboardingDismissedKey =
      'watch.launcher_onboarding_dismissed';

  Future<List<OfflineEvent>> loadOfflineQueue() async {
    final store = await prefs;
    final raw = store.getString(_offlineQueueKey);
    if (raw == null || raw.isEmpty) return [];
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .map((item) => OfflineEvent.fromStorageJson(
              Map<String, dynamic>.from(item as Map),
            ))
        .toList();
  }

  Future<void> saveOfflineQueue(List<OfflineEvent> events) async {
    final store = await prefs;
    final encoded = jsonEncode(events.map((e) => e.toStorageJson()).toList());
    await store.setString(_offlineQueueKey, encoded);
  }

  Future<List<WatchAlert>> loadAlerts() async {
    final store = await prefs;
    final raw = store.getString(_alertsKey);
    if (raw == null || raw.isEmpty) return [];
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .map((item) => WatchAlert.fromStorageJson(
              Map<String, dynamic>.from(item as Map),
            ))
        .toList();
  }

  Future<void> saveAlerts(List<WatchAlert> alerts) async {
    final store = await prefs;
    final encoded = jsonEncode(alerts.map((a) => a.toStorageJson()).toList());
    await store.setString(_alertsKey, encoded);
  }

  Future<void> savePairingCode(String? code) async {
    final store = await prefs;
    if (code == null) {
      await store.remove(_pairingCodeKey);
      return;
    }
    await store.setString(_pairingCodeKey, code);
  }

  Future<String?> readPairingCode() async {
    final store = await prefs;
    return store.getString(_pairingCodeKey);
  }

  Future<void> setPaired(bool value) async {
    final store = await prefs;
    await store.setBool(_isPairedKey, value);
  }

  Future<bool> isPaired() async {
    final store = await prefs;
    return store.getBool(_isPairedKey) ?? false;
  }

  Future<bool> isLauncherOnboardingDismissed() async {
    final store = await prefs;
    return store.getBool(_launcherOnboardingDismissedKey) ?? false;
  }

  Future<void> setLauncherOnboardingDismissed(bool value) async {
    final store = await prefs;
    await store.setBool(_launcherOnboardingDismissedKey, value);
  }
}
