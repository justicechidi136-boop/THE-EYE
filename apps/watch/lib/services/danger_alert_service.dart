import '../alerts/danger_alert_models.dart';
import '../api/watch_api_client.dart';
import '../api/watch_api_paths.dart';
import '../pairing/companion_relay_service.dart';
import '../storage/secure_credential_store.dart';
import 'alert_version_tracker.dart';
import 'audio_output_service.dart';
import 'danger_alert_coordinator.dart';
import 'danger_alert_tts_service.dart';
import 'quiet_hours_service.dart';
import 'vibration_service.dart';
import 'watch_feature_flags_service.dart';

class DangerAlertService {
  factory DangerAlertService({
    required WatchApiClient api,
    required SecureCredentialStore credentials,
    required PreferencesStore preferences,
    required VibrationService vibration,
    DangerAlertTtsService? tts,
    AlertVersionTracker? versionTracker,
    CompanionRelayService? companionRelay,
    WatchFeatureFlagsService? featureFlags,
    QuietHoursService? quietHours,
    AudioOutputService? audioOutput,
  }) {
    final resolvedTracker =
        versionTracker ?? AlertVersionTracker(preferences: preferences);
    return DangerAlertService._(
      api: api,
      credentials: credentials,
      preferences: preferences,
      vibration: vibration,
      versionTracker: resolvedTracker,
      companionRelay: companionRelay,
      featureFlags: featureFlags,
      quietHours: quietHours,
      audioOutput: audioOutput,
      tts: tts,
    );
  }

  DangerAlertService._({
    required WatchApiClient api,
    required SecureCredentialStore credentials,
    required PreferencesStore preferences,
    required VibrationService vibration,
    required AlertVersionTracker versionTracker,
    CompanionRelayService? companionRelay,
    WatchFeatureFlagsService? featureFlags,
    QuietHoursService? quietHours,
    AudioOutputService? audioOutput,
    DangerAlertTtsService? tts,
  })  : _api = api,
        _credentials = credentials,
        _preferences = preferences,
        _featureFlags = featureFlags ??
            WatchFeatureFlagsService(api: api, credentials: credentials),
        _companionRelay = companionRelay ?? CompanionRelayService(),
        _coordinator = DangerAlertCoordinator(
          vibration: vibration,
          versionTracker: versionTracker,
          quietHours: quietHours,
          audioOutput: audioOutput,
          tts: tts,
        ) {
    _coordinator.onNavigate = null;
  }

  final WatchApiClient _api;
  final SecureCredentialStore _credentials;
  final PreferencesStore _preferences;
  final WatchFeatureFlagsService _featureFlags;
  final CompanionRelayService _companionRelay;
  final DangerAlertCoordinator _coordinator;

  set onNavigate(DangerAlertNavigateHandler? handler) {
    _coordinator.onNavigate = handler;
  }

  DangerAlertTtsService get tts => _coordinator.tts;

  Future<void> initialize() async {
    final cached = await _preferences.loadAccessibilityPreferences();
    _coordinator.updatePreferences(cached);
    await _featureFlags.syncFromServer();
    await syncPreferencesFromServer();

    _companionRelay.onDangerAlert = (payload) async {
      if (!_featureFlags.isEnabled('WATCH_PHONE_RELAY')) return;
      await handleIncoming(
        payload.copyWith(deliverySource: DangerAlertDeliverySource.phoneRelay),
      );
    };
    _companionRelay.onAckFromPhone = (alertId) async {
      final entries = await _preferences.loadAlertVersionEntries();
      final entry = entries[alertId];
      if (entry == null) return;
      entries[alertId] = AlertVersionEntry(
        alertId: alertId,
        highestVersionSeen: entry.highestVersionSeen,
        highestAckVersion: entry.highestVersionSeen,
        lifecycleState: DangerAlertLifecycleState.acknowledged.name,
        updatedAt: DateTime.now(),
        lastSource: entry.lastSource,
      );
      await _preferences.saveAlertVersionEntries(entries);
    };
    await _companionRelay.startListening();
    await flushQueuedAcknowledgements();
  }

  Future<void> syncPreferencesFromServer() async {
    final accessToken = await _credentials.readAccessToken();
    final deviceId = await _credentials.readDeviceId();
    if (accessToken == null || deviceId == null) return;

    _api.accessToken = accessToken;
    try {
      final response = await _api.get(
        WatchApiPaths.accessibilityPreferences(deviceId),
      );
      final preferencesJson = response['preferences'];
      if (preferencesJson is Map<String, dynamic>) {
        final preferences = WatchAccessibilityPreferences.fromJson(preferencesJson);
        _coordinator.updatePreferences(preferences);
        await _preferences.saveAccessibilityPreferences(preferences);
      }
    } catch (_) {}
  }

  Future<void> savePreferences(WatchAccessibilityPreferences preferences) async {
    _coordinator.updatePreferences(preferences);
    await _preferences.saveAccessibilityPreferences(preferences);

    final accessToken = await _credentials.readAccessToken();
    final deviceId = await _credentials.readDeviceId();
    if (accessToken == null || deviceId == null) return;

    _api.accessToken = accessToken;
    try {
      await _api.patch(
        WatchApiPaths.accessibilityPreferences(deviceId),
        body: {'deviceId': deviceId, 'preferences': preferences.toJson()},
      );
    } catch (_) {}
  }

  Future<void> handleIncoming(DangerAlertPayload payload) async {
    if (!_featureFlags.isEnabled('WATCH_SPOKEN_DANGER_ALERTS')) return;
    if (payload.deliverySource == DangerAlertDeliverySource.fcm &&
        !_featureFlags.isEnabled('WATCH_STANDALONE_ALERTS') &&
        !_featureFlags.isEnabled('WATCH_PHONE_RELAY')) {
      return;
    }
    await _coordinator.handleIncoming(payload);
    await _recordTelemetry(payload, 'received', channel: payload.deliverySource.name);
  }

  Future<void> acknowledgeActive(DangerAlertPayload payload) async {
    await _coordinator.acknowledgeActive();
    await _companionRelay.sendAcknowledgement(payload.safetyAlertId);
    if (_featureFlags.isEnabled('WATCH_ALERT_ACKNOWLEDGEMENT')) {
      await _queueOrSendAcknowledgement(payload);
    }
    await _recordTelemetry(payload, 'acknowledged');
  }

  Future<void> muteActive() => _coordinator.muteActive();

  Future<void> replayActive() => _coordinator.replayActive();

  Future<void> dispose() async {
    await _companionRelay.dispose();
    await _coordinator.dispose();
  }

  Future<void> _queueOrSendAcknowledgement(DangerAlertPayload payload) async {
    final accessToken = await _credentials.readAccessToken();
    final deviceId = await _credentials.readDeviceId();
    if (accessToken == null || deviceId == null) {
      await _preferences.queueDangerAlertAck(payload.safetyAlertId);
      return;
    }

    _api.accessToken = accessToken;
    try {
      await _api.post(
        WatchApiPaths.safetyAlertAcknowledge(payload.safetyAlertId),
        body: {'deviceId': deviceId},
      );
    } catch (_) {
      await _preferences.queueDangerAlertAck(payload.safetyAlertId);
    }

    final notificationId = payload.notificationId;
    if (notificationId != null && notificationId.isNotEmpty) {
      try {
        await _api.patch(
          WatchApiPaths.notificationDeviceReceived(notificationId),
          body: {'source': 'watch_danger_ack'},
        );
      } catch (_) {}
    }
  }

  Future<void> flushQueuedAcknowledgements() async {
    final queued = await _preferences.loadQueuedDangerAlertAcks();
    if (queued.isEmpty) return;

    final accessToken = await _credentials.readAccessToken();
    final deviceId = await _credentials.readDeviceId();
    if (accessToken == null || deviceId == null) return;

    _api.accessToken = accessToken;
    final remaining = <String>[];
    for (final alertId in queued) {
      try {
        await _api.post(
          WatchApiPaths.safetyAlertAcknowledge(alertId),
          body: {'deviceId': deviceId},
        );
      } catch (_) {
        remaining.add(alertId);
      }
    }
    await _preferences.saveQueuedDangerAlertAcks(remaining);
  }

  Future<void> _recordTelemetry(
    DangerAlertPayload payload,
    String event, {
    String? channel,
    String? reason,
  }) async {
    final accessToken = await _credentials.readAccessToken();
    final deviceId = await _credentials.readDeviceId();
    if (accessToken == null) return;

    _api.accessToken = accessToken;
    try {
      await _api.post(
        WatchApiPaths.telemetry,
        body: {
          'safetyAlertId': payload.safetyAlertId,
          if (deviceId != null) 'deviceId': deviceId,
          'event': event,
          if (channel != null) 'channel': channel,
          if (reason != null) 'reason': reason,
          'language': _coordinator.preferences.preferredSpokenLanguage,
        },
      );
    } catch (_) {}
  }
}
