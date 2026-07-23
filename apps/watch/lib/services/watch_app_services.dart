import 'dart:async';

import '../api/watch_api_client.dart';
import '../models/connectivity_mode.dart';
import '../pairing/pairing_service.dart';
import '../pairing/watch_companion_transport.dart';
import '../services/alert_service.dart';
import '../services/connectivity_service.dart';
import '../services/device_telemetry_service.dart';
import '../services/emergency_foreground_service.dart';
import '../services/heartbeat_service.dart';
import '../services/location_service.dart';
import '../services/push_messaging_service.dart';
import '../services/sos_service.dart';
import '../services/standalone_auth_service.dart';
import '../services/version_compatibility_service.dart';
import '../services/vibration_service.dart';
import '../storage/encrypted_offline_queue_store.dart';
import '../storage/secure_credential_store.dart';
import '../storage/watch_settings_store.dart';

class WatchAppServices {
  WatchAppServices({
    WatchApiClient? apiClient,
    SecureCredentialStore? credentials,
    PreferencesStore? preferences,
    ConnectivityService? connectivity,
    VibrationService? vibration,
    WatchSettingsStore? settingsStore,
    EncryptedOfflineQueueStore? offlineQueue,
    EmergencyForegroundService? emergencyForeground,
    bool enablePush = true,
  })  : api = apiClient ?? WatchApiClient(),
        credentials = credentials ?? SecureCredentialStore(),
        preferences = preferences ?? PreferencesStore(),
        connectivity = connectivity ?? ConnectivityService(),
        vibration = vibration ?? VibrationService(),
        settings = settingsStore ?? WatchSettingsStore(),
        offlineQueue = offlineQueue ??
            EncryptedOfflineQueueStore(
              legacyPreferences: preferences ?? PreferencesStore(),
            ),
        emergencyForeground = emergencyForeground ?? EmergencyForegroundService(),
        _enablePush = enablePush {
    final creds = this.credentials;
    final directCompanion = DirectHttpsCompanionTransport(
      api: api,
      credentials: creds,
    );
    companion = WatchCompanionCoordinator(direct: directCompanion);
    standaloneAuth = StandaloneAuthService(api: api, credentials: creds);
    pairing = PairingService(
      api: api,
      credentials: creds,
      preferences: this.preferences,
    );
    location = LocationService(
      api: api,
      credentials: creds,
      connectivity: this.connectivity,
    );
    sos = SosService(
      api: api,
      credentials: creds,
      preferences: this.preferences,
      connectivity: this.connectivity,
      location: location,
      vibration: this.vibration,
      offlineQueue: this.offlineQueue,
      emergencyForeground: this.emergencyForeground,
    );
    heartbeat = HeartbeatService(
      api: api,
      credentials: creds,
      connectivity: this.connectivity,
    );
    alerts = AlertService(
      api: api,
      credentials: creds,
      preferences: this.preferences,
    );
    versionCompatibility = VersionCompatibilityService(
      api: api,
      credentials: creds,
      preferences: this.preferences,
    );
    push = PushMessagingService(alerts: alerts, credentials: creds);
  }

  final WatchApiClient api;
  final SecureCredentialStore credentials;
  final PreferencesStore preferences;
  final ConnectivityService connectivity;
  final VibrationService vibration;
  final WatchSettingsStore settings;
  final EncryptedOfflineQueueStore offlineQueue;
  final EmergencyForegroundService emergencyForeground;
  final bool _enablePush;

  late final WatchCompanionCoordinator companion;
  late final StandaloneAuthService standaloneAuth;
  late final PairingService pairing;
  late final LocationService location;
  late final SosService sos;
  late final HeartbeatService heartbeat;
  late final AlertService alerts;
  late final VersionCompatibilityService versionCompatibility;
  late final PushMessagingService push;
  DeviceTelemetryService? _telemetry;

  Future<void> initialize({
    bool firebaseReady = false,
    Duration pushTimeout = const Duration(seconds: 3),
  }) async {
    await standaloneAuth.hydrateApiAuth();
    await pairing.initialize();
    await companion.refreshConnectivity(({
      pairedPhoneAvailable,
      internetAvailable,
    }) {
      connectivity.update(
        pairedPhoneAvailable: pairedPhoneAvailable,
        internetAvailable: internetAvailable,
      );
    });
    final localSettings = await settings.load();
    connectivity.update(
      failoverEnabled: localSettings.failoverEnabled,
      preferredMode: localSettings.preferredConnectionMode == 'standaloneCellular'
          ? WatchConnectivityMode.standaloneCellular
          : WatchConnectivityMode.pairedPhone,
    );
    vibration.setEnabled(localSettings.vibrationEnabled);
    await sos.restoreEmergencyAfterBoot();
    _telemetry = DeviceTelemetryService(
      connectivity: connectivity,
      onBackOnline: watchOfflineReplay(sos),
    );
    await _telemetry!.start();
    await startRuntimeServices(
      firebaseReady: firebaseReady,
      pushTimeout: pushTimeout,
    );
    unawaited(alerts.syncHistoryFromServer());
  }

  /// Starts heartbeat / location / optional push without blocking forever on FCM.
  Future<void> startRuntimeServices({
    bool firebaseReady = false,
    Duration pushTimeout = const Duration(seconds: 3),
  }) async {
    heartbeat.start();
    location.startIdleTracking();
    if (firebaseReady && _enablePush) {
      try {
        await push.start().timeout(pushTimeout);
      } catch (_) {
        // Continue degraded — boot must not hang on FCM / network.
      }
    }
  }

  void dispose() {
    _telemetry?.dispose();
    heartbeat.stop();
    location.stopTracking();
    sos.dispose();
    pairing.dispose();
    push.dispose();
    api.dispose();
  }
}
