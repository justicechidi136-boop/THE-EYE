import 'package:uuid/uuid.dart';

import '../api/watch_api_client.dart';
import '../api/watch_api_paths.dart';
import '../config/watch_flavor.dart';
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
    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    if (deviceId != null &&
        deviceSecret != null &&
        deviceSecret.isNotEmpty) {
      await _api.post(
        WatchApiPaths.devicePushTokens(deviceId),
        body: {
          'deviceSecret': deviceSecret,
          'token': token,
          'platform': 'android_watch',
          'provider': 'fcm',
          'appEnvironment': WatchFlavor.envName,
        },
      );
      return;
    }

    final accessToken = await _credentials.readAccessToken();
    if (accessToken == null) return;

    _api.accessToken = accessToken;
    await _api.post(
      WatchApiPaths.pushTokens,
      body: {
        'token': token,
        'platform': 'android_watch',
        'provider': 'fcm',
        'appEnvironment': WatchFlavor.envName,
        if (deviceId != null) 'deviceId': deviceId,
      },
    );
  }

  Future<void> deactivatePushTokens() async {
    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    if (deviceId != null &&
        deviceSecret != null &&
        deviceSecret.isNotEmpty) {
      await _api.patch(
        WatchApiPaths.devicePushTokensDeactivate(deviceId),
        body: {'deviceSecret': deviceSecret},
      );
      return;
    }

    final accessToken = await _credentials.readAccessToken();
    if (accessToken == null || deviceId == null) return;
    _api.accessToken = accessToken;
    await _api.patch(
      WatchApiPaths.pushTokensDeactivateAll,
      body: {'deviceId': deviceId},
    );
  }

  Future<List<WatchAlert>> loadHistory() => _preferences.loadAlerts();

  Future<void> recordIncoming({
    required String title,
    required String body,
    String? incidentId,
    String? notificationId,
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
        notificationId: notificationId,
        priority: priority,
      ),
    );
    await _preferences.saveAlerts(alerts.take(50).toList());

    if (notificationId != null && notificationId.isNotEmpty) {
      await acknowledgeDelivery(notificationId);
    }
  }

  Future<void> acknowledge(String alertId) async {
    final alerts = await _preferences.loadAlerts();
    WatchAlert? target;
    for (final alert in alerts) {
      if (alert.id == alertId) {
        target = alert;
        break;
      }
    }
    final updated = alerts
        .map((alert) =>
            alert.id == alertId ? alert.copyWith(acknowledged: true) : alert)
        .toList();
    await _preferences.saveAlerts(updated);
    final notificationId = target?.notificationId;
    if (notificationId != null && notificationId.isNotEmpty) {
      await acknowledgeDelivery(notificationId);
    }
  }

  Future<void> acknowledgeDelivery(String notificationId) async {
    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    if (deviceId != null &&
        deviceSecret != null &&
        deviceSecret.isNotEmpty) {
      await _api.patch(
        WatchApiPaths.notificationAck(deviceId, notificationId),
        body: {
          'deviceSecret': deviceSecret,
          'source': 'watch_ack',
        },
      );
      return;
    }

    final accessToken = await _credentials.readAccessToken();
    if (accessToken == null) return;
    _api.accessToken = accessToken;
    await _api.patch(
      WatchApiPaths.notificationDeviceReceived(notificationId),
      body: {'source': 'watch_ack'},
    );
  }
}
