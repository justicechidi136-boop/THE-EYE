import 'dart:async';
import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show Color;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:just_audio/just_audio.dart';

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
    AudioPlayer? originalVoicePlayer,
  }) : _api = api,
       _session = session,
       _messagingOverride = messaging,
       _notifications = notifications ?? FlutterLocalNotificationsPlugin(),
       _tts = tts ?? FlutterTts(),
       _originalVoicePlayer = originalVoicePlayer ?? AudioPlayer();

  static const channelId = 'the_eye_danger_alerts_v2';
  final FieldApiClient _api;
  final SecureSessionStore _session;
  final FirebaseMessaging? _messagingOverride;
  final FlutterLocalNotificationsPlugin _notifications;
  final FlutterTts _tts;
  final AudioPlayer _originalVoicePlayer;
  final _alerts = StreamController<FieldDangerAlert>.broadcast();
  final _seen = <String>{};
  final ValueNotifier<FieldDangerAlert?> activeAlert = ValueNotifier(null);
  final ValueNotifier<FieldDangerAudioState> audioState = ValueNotifier(
    FieldDangerAudioState.idle,
  );
  FirebaseMessaging? _messaging;
  bool _initialized = false;
  int _audioGeneration = 0;
  FieldDangerAlert? _playingAlert;

  static const _completedAudioKey = 'field.danger.completed_audio_revisions';

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
    final playing = _playingAlert;
    if (playing != null &&
        (alert.priorityRank < playing.priorityRank ||
            (alert.priorityRank == playing.priorityRank &&
                !alert.issuedAt.isAfter(playing.issuedAt)))) {
      return;
    }
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
    activeAlert.value = alert;
    _alerts.add(alert);
    await _playSequence(alert, automatic: true);
  }

  Future<void> _playSequence(
    FieldDangerAlert alert, {
    required bool automatic,
  }) async {
    if (automatic && await _audioCompleted(alert.dedupeKey)) return;
    await dismissSound(markIdle: false);
    _playingAlert = alert;
    final generation = ++_audioGeneration;
    audioState.value = FieldDangerAudioState.alerting;
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (!_audioCurrent(generation, alert)) return;

    final preferred = await _session.readPreferredLocale() ?? 'en-NG';
    final available = await _tts.isLanguageAvailable(preferred) == true;
    await _tts.awaitSpeakCompletion(true);
    await _tts.setLanguage(available ? preferred : 'en-NG');
    await _tts.setSpeechRate(0.45);
    await _tts.setPitch(1.0);
    await _tts.setVolume(1.0);
    audioState.value = FieldDangerAudioState.speakingWarning;
    await _tts.speak(alert.speech);
    if (!_audioCurrent(generation, alert)) return;

    if (alert.hasOriginalVoice) {
      final signedUrl = await _loadOriginalVoice(alert);
      if (signedUrl != null &&
          signedUrl.isNotEmpty &&
          _audioCurrent(generation, alert)) {
        audioState.value = FieldDangerAudioState.playingOriginalVoice;
        await _originalVoicePlayer.setUrl(signedUrl);
        await _originalVoicePlayer.play();
      }
    }
    if (!_audioCurrent(generation, alert)) return;
    audioState.value = FieldDangerAudioState.completed;
    if (automatic) await _markAudioCompleted(alert.dedupeKey);
    _playingAlert = null;
  }

  Future<String?> _loadOriginalVoice(FieldDangerAlert alert) async {
    try {
      final response = await _api.get(
        FieldApiPaths.dangerTriggerOriginalVoice(alert.eventId),
      );
      final data = response['data'] as Map<String, dynamic>?;
      return data?['signedUrl']?.toString();
    } catch (_) {
      return null;
    }
  }

  Future<bool> _audioCompleted(String key) async {
    final raw = await _session.readRaw(_completedAudioKey);
    if (raw == null || raw.isEmpty) return false;
    try {
      return (jsonDecode(raw) as List<dynamic>)
          .map((value) => value.toString())
          .contains(key);
    } catch (_) {
      return false;
    }
  }

  Future<void> _markAudioCompleted(String key) async {
    final raw = await _session.readRaw(_completedAudioKey);
    var values = <String>[];
    try {
      values =
          raw == null
              ? <String>[]
              : (jsonDecode(raw) as List<dynamic>)
                  .map((value) => value.toString())
                  .toList();
    } catch (_) {
      values = <String>[];
    }
    if (!values.contains(key)) values.add(key);
    if (values.length > 100) values = values.sublist(values.length - 100);
    await _session.writeRaw(_completedAudioKey, jsonEncode(values));
  }

  bool _audioCurrent(int generation, FieldDangerAlert alert) =>
      generation == _audioGeneration &&
      _playingAlert?.dedupeKey == alert.dedupeKey;

  Future<void> replay(FieldDangerAlert alert) =>
      _playSequence(alert, automatic: false);

  Future<void> dismissSound({bool markIdle = true}) async {
    _audioGeneration += 1;
    await _tts.stop();
    await _originalVoicePlayer.stop();
    _playingAlert = null;
    if (markIdle) audioState.value = FieldDangerAudioState.idle;
  }

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
      await dismissSound();
      await _originalVoicePlayer.dispose();
    } catch (_) {
      // Platform channels are unavailable in unit tests and during teardown.
    }
    activeAlert.dispose();
    audioState.dispose();
    await _alerts.close();
  }
}

enum FieldDangerAudioState {
  idle,
  alerting,
  speakingWarning,
  playingOriginalVoice,
  completed,
}
