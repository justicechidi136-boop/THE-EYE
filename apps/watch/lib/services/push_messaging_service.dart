import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';

import '../alerts/danger_alert_models.dart';
import '../storage/secure_credential_store.dart';
import 'alert_service.dart';
import 'danger_alert_service.dart';
import 'push_background_handler.dart';
import 'push_message_router.dart';

typedef WatchActiveEmergencyRefreshHandler = Future<void> Function({
  required String? incidentId,
  required String category,
});

typedef WatchDangerAlertNavigateHandler = Future<void> Function(
  DangerAlertPayload payload,
);

class PushMessagingService {
  PushMessagingService({
    required AlertService alerts,
    required SecureCredentialStore credentials,
    required DangerAlertService dangerAlerts,
    FirebaseMessaging? messaging,
  })  : _alerts = alerts,
        _credentials = credentials,
        _dangerAlerts = dangerAlerts,
        _messagingOverride = messaging;

  WatchActiveEmergencyRefreshHandler? onActiveEmergencyRefresh;
  WatchDangerAlertNavigateHandler? onDangerAlert;

  final AlertService _alerts;
  final SecureCredentialStore _credentials;
  final DangerAlertService _dangerAlerts;
  final FirebaseMessaging? _messagingOverride;
  FirebaseMessaging? _messagingLazy;

  FirebaseMessaging get _messaging =>
      _messagingOverride ?? (_messagingLazy ??= FirebaseMessaging.instance);

  StreamSubscription<String>? _refreshSubscription;
  StreamSubscription<RemoteMessage>? _foregroundSubscription;
  StreamSubscription<RemoteMessage>? _openedSubscription;
  bool _started = false;
  bool _registrationAllowed = false;
  String? _lastIncidentPushKey;
  String? _lastDangerAlertKey;

  Future<void> start() async {
    if (!_started) {
      await _messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );

      final permission = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      _registrationAllowed =
          permission.authorizationStatus != AuthorizationStatus.denied;

      PushMessageRouter.onAlert = _handleAlert;
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      _foregroundSubscription = FirebaseMessaging.onMessage.listen(
        PushMessageRouter.handleForeground,
      );
      _openedSubscription = FirebaseMessaging.onMessageOpenedApp.listen(
        PushMessageRouter.handleForeground,
      );
      _refreshSubscription = _messaging.onTokenRefresh.listen((token) async {
        await _alerts.registerPushToken(token);
      });
      _started = true;
    }

    await refreshRegistration();
  }

  Future<bool> refreshRegistration() async {
    if (!_started || !_registrationAllowed) return false;
    final token = await _messaging.getToken();
    if (token != null && token.isNotEmpty) {
      await _alerts.registerPushToken(token);
      return true;
    }
    return _alerts.retryStoredPushTokenRegistration();
  }

  Future<void> revokeToken() async {
    final token = await _credentials.readPushToken();
    if (token != null && token.isNotEmpty) {
      try {
        await _messaging.deleteToken();
      } catch (_) {
        // Best-effort local revoke; server deactivation happens via API when paired.
      }
    }
    await _credentials.savePushToken(null);
  }

  Future<void> dispose() async {
    await _refreshSubscription?.cancel();
    await _foregroundSubscription?.cancel();
    await _openedSubscription?.cancel();
    _started = false;
    _registrationAllowed = false;
    PushMessageRouter.onAlert = null;
  }

  Future<void> _handleAlert({
    required String title,
    required String body,
    String? incidentId,
    String? notificationId,
    String priority = 'High',
    String category = WatchPushCategories.emergencyAlert,
    Map<String, dynamic> data = const {},
    DangerAlertPayload? dangerAlert,
  }) async {
    await _alerts.recordIncoming(
      title: title,
      body: body,
      incidentId: incidentId,
      notificationId: notificationId,
      priority: priority,
    );

    if (category == WatchPushCategories.nearbyDangerWarning &&
        dangerAlert != null) {
      if (_lastDangerAlertKey == dangerAlert.dedupeKey) return;
      _lastDangerAlertKey = dangerAlert.dedupeKey;

      final enriched = dangerAlert.copyWith(
        notificationId: notificationId,
        displayTitle: title,
        displayBody: body,
        deliverySource: DangerAlertDeliverySource.fcm,
      );

      await _dangerAlerts.handleIncoming(enriched);
      await onDangerAlert?.call(enriched);
      return;
    }

    if (category == WatchPushCategories.incidentStatus ||
        category == WatchPushCategories.emergencyAlert) {
      final key = '$category:${incidentId ?? notificationId ?? title}';
      if (_lastIncidentPushKey == key) return;
      _lastIncidentPushKey = key;
      await onActiveEmergencyRefresh?.call(
        incidentId: incidentId,
        category: category,
      );
    }
  }
}
