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
  final Set<String> _seenNotificationIds = {};

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

  Future<int> unreadCount() async {
    final alerts = await _preferences.loadAlerts();
    return alerts
        .where((alert) => !alert.read && !alert.dismissed && !alert.expired)
        .length;
  }

  Future<void> syncHistoryFromServer({String? cursor}) async {
    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    if (deviceId == null || deviceSecret == null) return;

    try {
      final response = await _api.get(
        WatchApiPaths.deviceNotifications(deviceId),
        query: {
          'deviceSecret': deviceSecret,
          if (cursor != null) 'cursor': cursor,
          'limit': '30',
        },
      );
      final rows = response['data'] as List<dynamic>? ?? [];
      if (rows.isEmpty) return;
      final remote = rows
          .map(
            (row) => WatchAlert.fromApiJson(
              Map<String, dynamic>.from(row as Map),
            ),
          )
          .toList();
      await _mergeAlerts(remote);
      final nextCursor = response['nextCursor'] as String?;
      if (response['hasMore'] == true && nextCursor != null) {
        await syncHistoryFromServer(cursor: nextCursor);
      }
    } catch (_) {}
  }

  Future<void> _mergeAlerts(List<WatchAlert> remote) async {
    final local = await _preferences.loadAlerts();
    final byNotificationId = {
      for (final alert in local)
        if (alert.notificationId != null) alert.notificationId!: alert,
    };
    for (final alert in remote) {
      final key = alert.notificationId;
      if (key != null) {
        byNotificationId[key] = alert.copyWith(
          read: byNotificationId[key]?.read ?? alert.read,
          acknowledged:
              byNotificationId[key]?.acknowledged ?? alert.acknowledged,
        );
      }
    }
    final merged = byNotificationId.values.toList()
      ..sort((a, b) => b.receivedAt.compareTo(a.receivedAt));
    await _preferences.saveAlerts(merged.take(50).toList());
  }

  Future<void> recordIncoming({
    required String title,
    required String body,
    String? incidentId,
    String? notificationId,
    String priority = 'High',
    String? category,
    String? locationLabel,
  }) async {
    if (notificationId != null &&
        notificationId.isNotEmpty &&
        _seenNotificationIds.contains(notificationId)) {
      return;
    }
    if (notificationId != null && notificationId.isNotEmpty) {
      _seenNotificationIds.add(notificationId);
    }

    final alerts = await _preferences.loadAlerts();
    if (notificationId != null &&
        alerts.any((alert) => alert.notificationId == notificationId)) {
      return;
    }
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
        category: category,
        locationLabel: locationLabel,
      ),
    );
    await _preferences.saveAlerts(alerts.take(50).toList());

    if (notificationId != null && notificationId.isNotEmpty) {
      await recordDeviceReceived(notificationId);
    }
  }

  Future<void> markRead(String alertId) async {
    final alerts = await _preferences.loadAlerts();
    final updated = alerts
        .map(
          (alert) => alert.id == alertId ? alert.copyWith(read: true) : alert,
        )
        .toList();
    await _preferences.saveAlerts(updated);
    final target = updated.firstWhere(
      (alert) => alert.id == alertId,
      orElse: () => alerts.first,
    );
    final notificationId = target.notificationId;
    if (notificationId != null && notificationId.isNotEmpty) {
      await _markReadOnServer(notificationId);
    }
  }

  Future<void> dismiss(String alertId) async {
    final alerts = await _preferences.loadAlerts();
    final updated = alerts
        .map(
          (alert) =>
              alert.id == alertId ? alert.copyWith(dismissed: true) : alert,
        )
        .toList();
    await _preferences.saveAlerts(updated);
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
        .map(
          (alert) => alert.id == alertId
              ? alert.copyWith(acknowledged: true, read: true)
              : alert,
        )
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

  Future<void> recordDeviceReceived(String notificationId) async {
    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    if (deviceId == null || deviceSecret == null) return;
    await _api.patch(
      WatchApiPaths.notificationAck(deviceId, notificationId),
      body: {
        'deviceSecret': deviceSecret,
        'source': 'foreground',
      },
    );
  }

  Future<void> _markReadOnServer(String notificationId) async {
    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    if (deviceId == null || deviceSecret == null) return;
    await _api.patch(
      WatchApiPaths.notificationRead(deviceId, notificationId),
      body: {'deviceSecret': deviceSecret},
    );
  }

  Future<void> clearLocalHistory() => _preferences.saveAlerts([]);
}
