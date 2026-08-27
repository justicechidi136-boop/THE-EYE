import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show Color;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_tts/flutter_tts.dart';

import '../api/field_api_client.dart';
import '../api/field_api_paths.dart';
import '../config/app_flavor.dart';
import '../security/secure_session_store.dart';
import 'field_danger_alert.dart';

class FieldDangerAlertService {
  FieldDangerAlertService({
    required FieldApiClient api,
    required SecureSessionStore session,
    FirebaseMessaging? messaging,
    FlutterLocalNotificationsPlugin? notifications,
    FlutterTts? tts,
  }) : _api = api,
       _session = session,
       _messagingOverride = messaging,
       _notifications = notifications ?? FlutterLocalNotificationsPlugin(),
       _tts = tts ?? FlutterTts();

  static const channelId = 'the_eye_danger_alerts_v2';
  final FieldApiClient _api;
  final SecureSessionStore _session;
  final FirebaseMessaging? _messagingOverride;
  final FlutterLocalNotificationsPlugin _notifications;
  final FlutterTts _tts;
  final _alerts = StreamController<FieldDangerAlert>.broadcast();
  final _seen = <String>{};
  final ValueNotifier<FieldDangerAlert?> activeAlert = ValueNotifier(null);
  FirebaseMessaging? _messaging;
  bool _initialized = false;

  Stream<FieldDangerAlert> get alerts => _alerts.stream;

  Future<void> initialize() async {
    if (_initialized) {
      await registerToken();
      return;
    }
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp();
    }
    _messaging = _messagingOverride ?? FirebaseMessaging.instance;
    await _notifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      ),
    );
    final android =
        _notifications
            .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin
            >();
    await android?.createNotificationChannel(
      AndroidNotificationChannel(
        channelId,
        'Danger alerts',
        description: 'Urgent geographically authorized danger alerts',
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
        vibrationPattern: Int64List.fromList([0, 700, 180, 700, 180, 1000]),
        enableLights: true,
        ledColor: const Color(0xFFD32F2F),
        audioAttributesUsage: AudioAttributesUsage.alarm,
      ),
    );
    await _messaging!.requestPermission(alert: true, badge: true, sound: true);
    FirebaseMessaging.onMessage.listen((message) => _handle(message.data));
    FirebaseMessaging.onMessageOpenedApp.listen(
      (message) => _handle(message.data),
    );
    final initial = await _messaging!.getInitialMessage();
    if (initial != null) await _handle(initial.data);
    _messaging!.onTokenRefresh.listen((_) => registerToken());
    _initialized = true;
    await registerToken();
  }

  Future<void> registerToken() async {
    final accessToken = await _session.readAccessToken();
    if (accessToken == null || accessToken.isEmpty || _messaging == null) {
      return;
    }
    final token = await _messaging!.getToken();
    if (token == null || token.isEmpty) return;
    _api.accessToken = accessToken;
    await _api.post(
      FieldApiPaths.pushToken,
      body: {'token': token, 'appEnvironment': AppFlavor.envName},
    );
  }

  Future<void> _handle(Map<String, dynamic> data) async {
    final alert = FieldDangerAlert.fromData(data);
    if (alert == null || !_seen.add(alert.dedupeKey)) return;
    await _notifications.show(
      alert.dedupeKey.hashCode,
      'DANGER ALERT',
      '${alert.dangerType} reported in ${alert.area}',
      const NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          'Danger alerts',
          importance: Importance.max,
          priority: Priority.max,
          category: AndroidNotificationCategory.alarm,
          visibility: NotificationVisibility.public,
          color: Color(0xFFD32F2F),
          enableVibration: true,
          audioAttributesUsage: AudioAttributesUsage.alarm,
        ),
      ),
    );
    final preferred = await _session.readPreferredLocale() ?? 'en-NG';
    final available = await _tts.isLanguageAvailable(preferred) == true;
    await _tts.setLanguage(available ? preferred : 'en-NG');
    await _tts.setSpeechRate(0.45);
    await _tts.speak(alert.speech);
    activeAlert.value = alert;
    _alerts.add(alert);
  }

  Future<void> dismissSound() => _tts.stop();

  Future<void> acknowledge(FieldDangerAlert alert) async {
    await dismissSound();
    if (activeAlert.value?.dedupeKey == alert.dedupeKey) {
      activeAlert.value = null;
    }
  }

  void reopenActiveAlert() {
    final alert = activeAlert.value;
    if (alert != null && !alert.expired) {
      _alerts.add(alert);
    }
  }

  Future<void> dispose() async {
    try {
      await _tts.stop();
    } catch (_) {
      // Platform channels are unavailable in unit tests and during teardown.
    }
    activeAlert.dispose();
    await _alerts.close();
  }
}
