import '../alerts/danger_alert_models.dart';
import '../api/watch_api_client.dart';
import '../api/watch_api_paths.dart';
import '../storage/secure_credential_store.dart';
import 'danger_alert_coordinator.dart';
import 'danger_alert_tts_service.dart';
import 'vibration_service.dart';

class DangerAlertService {
  DangerAlertService({
    required WatchApiClient api,
    required SecureCredentialStore credentials,
    required PreferencesStore preferences,
    required VibrationService vibration,
    DangerAlertTtsService? tts,
  })  : _api = api,
        _credentials = credentials,
        _preferences = preferences,
        _coordinator = DangerAlertCoordinator(
          vibration: vibration,
          tts: tts,
        );

  final WatchApiClient _api;
  final SecureCredentialStore _credentials;
  final PreferencesStore _preferences;
  final DangerAlertCoordinator _coordinator;

  set onNavigate(DangerAlertNavigateHandler? handler) {
    _coordinator.onNavigate = handler;
  }

  DangerAlertTtsService get tts => _coordinator.tts;

  Future<void> initialize() async {
    final cached = await _preferences.loadAccessibilityPreferences();
    _coordinator.updatePreferences(cached);
    await syncPreferencesFromServer();
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
    await _coordinator.handleIncoming(payload);
  }

  Future<void> acknowledgeActive(DangerAlertPayload payload) async {
    await _coordinator.acknowledgeActive();
    await _queueOrSendAcknowledgement(payload);
  }

  Future<void> muteActive() => _coordinator.muteActive();

  Future<void> replayActive() => _coordinator.replayActive();

  Future<void> dispose() => _coordinator.dispose();

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
}
