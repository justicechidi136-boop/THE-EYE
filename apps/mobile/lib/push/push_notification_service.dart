import "dart:async";
import "dart:io";

import "package:firebase_core/firebase_core.dart";
import "package:firebase_messaging/firebase_messaging.dart";
import "package:flutter/foundation.dart";
import "package:flutter_local_notifications/flutter_local_notifications.dart";
import "package:permission_handler/permission_handler.dart";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "../startup/startup_diagnostics.dart";
import "../config/app_flavor.dart";
import "push_delivery_ack.dart";
import "push_device_id.dart";
import "push_deep_link_router.dart";
import "push_notification_channels.dart";
import "push_safe_log.dart";

typedef AccessTokenProvider = String? Function();
typedef RouteNavigator = Future<void> Function(String route);

class PushNotificationService {
  PushNotificationService({
    required TheEyeApiClient apiClient,
    required AccessTokenProvider accessTokenProvider,
    FirebaseMessaging? messaging,
    FlutterLocalNotificationsPlugin? localNotifications,
    PushDeliveryAckService? deliveryAck,
  })  : _apiClient = apiClient,
        _accessTokenProvider = accessTokenProvider,
        _messagingOverride = messaging,
        _localNotifications =
            localNotifications ?? FlutterLocalNotificationsPlugin(),
        _deliveryAck = deliveryAck ??
            PushDeliveryAckService(
              apiClient: apiClient,
              accessTokenProvider: accessTokenProvider,
            );

  final TheEyeApiClient _apiClient;
  final AccessTokenProvider _accessTokenProvider;
  final FirebaseMessaging? _messagingOverride;
  FirebaseMessaging? _messaging;
  final FlutterLocalNotificationsPlugin _localNotifications;
  final PushDeliveryAckService _deliveryAck;
  final StreamController<String> _routeController =
      StreamController<String>.broadcast();

  Stream<String> get routeStream => _routeController.stream;
  void Function(RemoteMessage message)? onForegroundMessage;
  bool _initialized = false;
  String? _lastRegisteredTokenSuffix;

  FirebaseMessaging get _messagingClient {
    final messaging = _messaging;
    if (messaging == null) {
      throw StateError(
        "PushNotificationService.initialize() must run after Firebase.initializeApp().",
      );
    }
    return messaging;
  }

  Future<void> initialize() async {
    if (_initialized) return;
    if (kIsWeb || !Platform.isAndroid) {
      logPushEvent("Push notifications are Android-only in this release.");
      return;
    }

    if (Firebase.apps.isEmpty) {
      throw StateError(
        "Firebase.initializeApp() must complete before push initialization.",
      );
    }

    try {
      _messaging = _messagingOverride ?? FirebaseMessaging.instance;
      await _configureLocalNotifications();
      await _requestPermissions();
      await _registerAndroidChannels();
      _listenForMessages();
      _listenForTokenRefresh();
      unawaited(
        syncTokenWithBackend().timeout(
          const Duration(seconds: 10),
          onTimeout: () {
            logPushEvent("FCM token registration skipped during startup.");
          },
        ),
      );
      _initialized = true;
      logPushEvent("FCM initialized for production project.");
      StartupDiagnostics.checkpoint("STARTUP 3: push service initialized");
    } catch (error) {
      logPushEvent(
          "FCM startup failed; continuing without push notifications.");
      StartupDiagnostics.checkpoint("STARTUP 3: push service skipped ($error)");
    }
  }

  Future<void> syncTokenWithBackend() async {
    if (kIsWeb || !Platform.isAndroid || !_initialized) return;
    final token = await _messagingClient
        .getToken()
        .timeout(const Duration(seconds: 10), onTimeout: () => null);
    if (token == null || token.isEmpty) {
      logPushEvent("FCM token unavailable; registration skipped.");
      return;
    }
    await _registerToken(token);
  }

  Future<void> deactivateCurrentToken() async {
    if (kIsWeb || !Platform.isAndroid || !_initialized) return;
    final accessToken = _accessTokenProvider();
    if (accessToken == null || accessToken.isEmpty) return;

    final deviceId = await resolveMobileDeviceId();
    try {
      await _apiClient.patchJson(
        TheEyeApiPaths.notificationsPushTokensDeactivateAll,
        {"deviceId": deviceId},
        accessToken: accessToken,
      );
      logPushEvent("Push tokens deactivated for device $deviceId.");
    } catch (error) {
      logPushEvent("Push token deactivation failed.");
    }

    _deliveryAck.reset();
  }

  Future<void> _requestPermissions() async {
    final settings = await _messagingClient.requestPermission(
        alert: true, badge: true, sound: true);
    if (!kIsWeb && Platform.isAndroid) {
      await Permission.notification.request();
    }
    logPushEvent(
        "Notification permission status: ${settings.authorizationStatus.name}");
  }

  Future<void> _configureLocalNotifications() async {
    const androidSettings =
        AndroidInitializationSettings("@drawable/ic_notification");
    const initSettings = InitializationSettings(android: androidSettings);
    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (response) {
        final route = response.payload;
        if (route != null && route.isNotEmpty) {
          _routeController.add(route);
        }
      },
    );
  }

  Future<void> _registerAndroidChannels() async {
    final androidPlugin =
        _localNotifications.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    if (androidPlugin == null) return;
    for (final channel in PushNotificationChannels.all) {
      await androidPlugin.createNotificationChannel(channel);
    }
  }

  void _listenForMessages() {
    FirebaseMessaging.onMessage.listen((message) {
      unawaited(_showForegroundNotification(message));
    });

    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      _handleOpenedMessage(message);
    });

    unawaited(_handleInitialMessage());
  }

  Future<void> _handleInitialMessage() async {
    final initialMessage = await _messagingClient.getInitialMessage();
    if (initialMessage != null) {
      _handleOpenedMessage(initialMessage);
    }
  }

  void _listenForTokenRefresh() {
    _messagingClient.onTokenRefresh.listen((token) {
      logPushEvent("FCM token refreshed (suffix ${maskPushToken(token)}).");
      unawaited(_registerToken(token));
    });
  }

  Future<void> _registerToken(String token) async {
    final accessToken = _accessTokenProvider();
    if (accessToken == null || accessToken.isEmpty) {
      logPushEvent("Citizen session required before push-token registration.");
      return;
    }

    final suffix = maskPushToken(token);
    if (_lastRegisteredTokenSuffix == suffix) {
      return;
    }

    try {
      final deviceId = await resolveMobileDeviceId();
      final response = await _apiClient.postJson(
        TheEyeApiPaths.notificationsPushTokens,
        {
          "token": token,
          "platform": "android",
          "deviceId": deviceId,
          "appEnvironment": AppFlavorConfig.firebaseEnvName,
        },
        accessToken: accessToken,
      );
      if (response.statusCode >= 200 && response.statusCode < 300) {
        _lastRegisteredTokenSuffix = suffix;
        logPushEvent("Push token registered with API (suffix $suffix).");
      } else {
        logPushEvent(
            "Push token registration rejected (HTTP ${response.statusCode}).");
      }
    } catch (error) {
      logPushEvent("Push token registration failed.");
    }
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    onForegroundMessage?.call(message);
    final notification = message.notification;
    final data = message.data;
    final route = PushDeepLinkRouter.resolveRoute(data) ?? "/notifications";
    final notificationId = data["notificationId"]?.toString() ?? "";
    if (notificationId.isNotEmpty) {
      unawaited(_deliveryAck.acknowledge(
        notificationId: notificationId,
        source: "foreground",
      ));
    }
    final channelId = PushNotificationChannels.resolveChannelId(
      type: data["type"]?.toString(),
      priority: data["priority"]?.toString(),
      route: route,
    );

    await _localNotifications.show(
      message.hashCode,
      notification?.title ?? data["title"]?.toString() ?? "THE EYE",
      notification?.body ??
          data["body"]?.toString() ??
          "New safety notification",
      NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          _channelName(channelId),
          channelDescription: "THE EYE safety notifications",
          icon: "ic_notification",
          importance: channelId == PushNotificationChannels.emergency.id
              ? Importance.max
              : Importance.high,
          priority: channelId == PushNotificationChannels.emergency.id
              ? Priority.max
              : Priority.high,
        ),
      ),
      payload: route,
    );
  }

  void _handleOpenedMessage(RemoteMessage message) {
    final data = message.data;
    final notificationId = data["notificationId"]?.toString() ?? "";
    if (notificationId.isNotEmpty) {
      unawaited(_deliveryAck.acknowledge(
        notificationId: notificationId,
        source: "opened",
      ));
    }
    final route = PushDeepLinkRouter.resolveRoute(data);
    if (route != null) {
      _routeController.add(route);
    }
  }

  String _channelName(String channelId) {
    for (final channel in PushNotificationChannels.all) {
      if (channel.id == channelId) return channel.name;
    }
    return PushNotificationChannels.general.name;
  }

  Future<void> dispose() async {
    await _routeController.close();
  }
}
