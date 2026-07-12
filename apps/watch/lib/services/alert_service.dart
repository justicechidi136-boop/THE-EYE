import 'package:uuid/uuid.dart';

import '../api/watch_api_client.dart';
import '../api/watch_api_paths.dart';
import '../models/alert.dart';
import '../storage/secure_credential_store.dart';

class AlertService {
  AlertService({
    required WatchApiClient api,
    required SecureCredentialStore credentials,
    required PreferencesStore preferences,
    Uuid? uuid,
  })  : _api = api,
        _credentials = credentials,
        _preferences = preferences,
        _uuid = uuid ?? const Uuid();

  final WatchApiClient _api;
  final SecureCredentialStore _credentials;
  final PreferencesStore _preferences;
  final Uuid _uuid;

  Future<void> registerPushToken(String token) async {
    await _credentials.savePushToken(token);
    final accessToken = await _credentials.readAccessToken();
    final deviceId = await _credentials.readDeviceId();
    if (accessToken == null) return;

    _api.accessToken = accessToken;
    await _api.post(
      WatchApiPaths.pushTokens,
      body: {
        'token': token,
        'platform': 'android_watch',
        'provider': 'fcm',
        if (deviceId != null) 'deviceId': deviceId,
      },
    );
  }

  Future<List<WatchAlert>> loadHistory() => _preferences.loadAlerts();

  Future<void> recordIncoming({
    required String title,
    required String body,
    String? incidentId,
    String priority = 'High',
  }) async {
    final alerts = await _preferences.loadAlerts();
    alerts.insert(
      0,
      WatchAlert(
        id: _uuid.v4(),
        title: title,
        body: body,
        receivedAt: DateTime.now(),
        incidentId: incidentId,
        priority: priority,
      ),
    );
    await _preferences.saveAlerts(alerts.take(50).toList());
  }

  Future<void> acknowledge(String alertId) async {
    final alerts = await _preferences.loadAlerts();
    final updated = alerts
        .map((alert) =>
            alert.id == alertId ? alert.copyWith(acknowledged: true) : alert)
        .toList();
    await _preferences.saveAlerts(updated);
  }
}
