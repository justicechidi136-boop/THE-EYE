import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';

import '../storage/secure_credential_store.dart';
import 'alert_navigation_service.dart';
import 'alert_service.dart';
import 'push_background_handler.dart';
import 'push_message_router.dart';

class PushMessagingService {
  PushMessagingService({
    required AlertService alerts,
    required SecureCredentialStore credentials,
    AlertNavigationService? navigation,
    FirebaseMessaging? messaging,
  })  : _alerts = alerts,
        _credentials = credentials,
        _navigation = navigation,
        _messagingOverride = messaging;

  AlertNavigationService? _navigation;

  final AlertService _alerts;
  final SecureCredentialStore _credentials;
  final FirebaseMessaging? _messagingOverride;
  FirebaseMessaging? _messagingLazy;

  FirebaseMessaging get _messaging =>
      _messagingOverride ?? (_messagingLazy ??= FirebaseMessaging.instance);

  StreamSubscription<String>? _refreshSubscription;
  bool _started = false;

  void bindNavigation(AlertNavigationService navigation) {
    _navigation = navigation;
  }

  Future<void> start() async {
    if (_started) return;
    _started = true;

    PushMessageRouter.onAlert = _handleAlert;
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    await _messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    FirebaseMessaging.onMessage.listen(PushMessageRouter.handleForeground);
    FirebaseMessaging.onMessageOpenedApp
        .listen(PushMessageRouter.handleForeground);

    final permission = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (permission.authorizationStatus == AuthorizationStatus.denied) {
      return;
    }

    final token = await _messaging.getToken();
    if (token != null && token.isNotEmpty) {
      await _alerts.registerPushToken(token);
    }

    _refreshSubscription = _messaging.onTokenRefresh.listen((token) async {
      await _alerts.registerPushToken(token);
    });
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
    PushMessageRouter.onAlert = null;
  }

  Future<void> _handleAlert({
    required String title,
    required String body,
    String? incidentId,
    String? notificationId,
    String priority = 'High',
    String category = WatchPushCategories.emergencyAlert,
  }) async {
    final navigation = _navigation;
    if (navigation != null) {
      await navigation.handlePushAlert(
        title: title,
        body: body,
        incidentId: incidentId,
        notificationId: notificationId,
        priority: priority,
        category: category,
      );
      return;
    }

    await _alerts.recordIncoming(
      title: title,
      body: body,
      incidentId: incidentId,
      notificationId: notificationId,
      priority: priority,
    );
  }
}
