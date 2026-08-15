import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../alerts/danger_alert_models.dart';
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
  static const _watchInternalIdKey = 'watch.internal_id';
  static const _ownerIdKey = 'watch.owner_id';
  static const _ownerTypeKey = 'watch.owner_type';
  static const _activationCompleteKey = 'watch.activation_complete';

  Future<String?> readDeviceId() => _read(_deviceIdKey);

  Future<String?> readDeviceSecret() => _read(_deviceSecretKey);

  Future<String?> readAccessToken() => _read(_accessTokenKey);

  Future<String?> readPushToken() => _read(_pushTokenKey);

  Future<String?> readWatchInternalId() => _read(_watchInternalIdKey);

  Future<String?> readOwnerId() => _read(_ownerIdKey);

  Future<String?> readOwnerType() => _read(_ownerTypeKey);

  Future<bool> isActivationComplete() async {
    final value = await _read(_activationCompleteKey);
    return value == 'true';
  }

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

  Future<void> saveActivationSession({
    required String deviceId,
    required String deviceSecret,
    required String accessToken,
    required String watchInternalId,
    String? ownerId,
    String? ownerType,
  }) async {
    await _write(_deviceIdKey, deviceId);
    await _write(_deviceSecretKey, deviceSecret);
    await _write(_accessTokenKey, accessToken);
    await _write(_watchInternalIdKey, watchInternalId);
    await _write(_activationCompleteKey, 'true');
    if (ownerId != null && ownerId.isNotEmpty) {
      await _write(_ownerIdKey, ownerId);
    } else {
      await _delete(_ownerIdKey);
    }
    if (ownerType != null && ownerType.isNotEmpty) {
      await _write(_ownerTypeKey, ownerType);
    } else {
      await _delete(_ownerTypeKey);
    }
  }

  Future<
      ({
        bool tokenPresent,
        bool deviceSecretPresent,
        String? deviceId,
      })> verifyActivationSession({
    required String expectedDeviceId,
  }) async {
    final deviceId = await readDeviceId();
    final secret = await readDeviceSecret();
    final token = await readAccessToken();
    return (
      tokenPresent: token != null && token.isNotEmpty,
      deviceSecretPresent: secret != null && secret.isNotEmpty,
      deviceId: deviceId,
    );
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
  static const _locationOnboardingDismissedKey =
      'watch.location_onboarding_dismissed';
  static const _preferredUiLocaleKey = 'watch.preferred_ui_locale';
  static const _activeEmergencyTrackingKey = 'watch.active_emergency_tracking';
  static const _accessibilityPrefsKey = 'watch.accessibility_preferences';
  static const _dangerAckQueueKey = 'watch.danger_alert_ack_queue';

  Future<void> saveActiveEmergencyTracking({
    required bool active,
    String? sosEventId,
  }) async {
    final store = await prefs;
    if (!active) {
      await store.remove(_activeEmergencyTrackingKey);
      return;
    }
    await store.setString(
      _activeEmergencyTrackingKey,
      jsonEncode({
        'active': true,
        if (sosEventId != null) 'sosEventId': sosEventId,
      }),
    );
  }

  Future<({bool active, String? sosEventId})?>
      loadActiveEmergencyTracking() async {
    final store = await prefs;
    final raw = store.getString(_activeEmergencyTrackingKey);
    if (raw == null || raw.isEmpty) return null;
    final decoded = Map<String, dynamic>.from(jsonDecode(raw) as Map);
    return (
      active: decoded['active'] as bool? ?? false,
      sosEventId: decoded['sosEventId'] as String?,
    );
  }

  Future<bool> isLocationOnboardingDismissed() async {
    final store = await prefs;
    return store.getBool(_locationOnboardingDismissedKey) ?? false;
  }

  Future<void> setLocationOnboardingDismissed(bool value) async {
    final store = await prefs;
    await store.setBool(_locationOnboardingDismissedKey, value);
  }

  Future<String?> readPreferredUiLocale() async {
    final store = await prefs;
    return store.getString(_preferredUiLocaleKey);
  }

  Future<void> savePreferredUiLocale(String locale) async {
    final store = await prefs;
    await store.setString(_preferredUiLocaleKey, locale);
  }

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

  Future<WatchAccessibilityPreferences> loadAccessibilityPreferences() async {
    final store = await prefs;
    final raw = store.getString(_accessibilityPrefsKey);
    if (raw == null || raw.isEmpty) {
      return const WatchAccessibilityPreferences();
    }
    return WatchAccessibilityPreferences.fromJson(
      Map<String, dynamic>.from(jsonDecode(raw) as Map),
    );
  }

  Future<void> saveAccessibilityPreferences(
    WatchAccessibilityPreferences preferences,
  ) async {
    final store = await prefs;
    await store.setString(
      _accessibilityPrefsKey,
      jsonEncode(preferences.toJson()),
    );
  }

  Future<List<String>> loadQueuedDangerAlertAcks() async {
    final store = await prefs;
    final raw = store.getString(_dangerAckQueueKey);
    if (raw == null || raw.isEmpty) return [];
    return (jsonDecode(raw) as List<dynamic>).map((e) => e.toString()).toList();
  }

  Future<void> queueDangerAlertAck(String alertId) async {
    final queued = await loadQueuedDangerAlertAcks();
    if (queued.contains(alertId)) return;
    queued.add(alertId);
    await saveQueuedDangerAlertAcks(queued);
  }

  Future<void> saveQueuedDangerAlertAcks(List<String> alertIds) async {
    final store = await prefs;
    await store.setString(_dangerAckQueueKey, jsonEncode(alertIds));
  }
}
