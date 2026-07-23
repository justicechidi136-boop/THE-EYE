import '../api/watch_api_client.dart';
import '../pairing/pairing_service.dart';
import '../services/alert_service.dart';
import '../services/connectivity_service.dart';
import '../services/device_telemetry_service.dart';
import '../services/heartbeat_service.dart';
import '../services/location_service.dart';
import '../services/push_messaging_service.dart';
import '../services/sos_service.dart';
import '../services/standalone_auth_service.dart';
import '../services/vibration_service.dart';
import '../storage/secure_credential_store.dart';

class WatchAppServices {
  WatchAppServices({
    WatchApiClient? apiClient,
    SecureCredentialStore? credentials,
    PreferencesStore? preferences,
    ConnectivityService? connectivity,
    VibrationService? vibration,
    bool enablePush = true,
  })  : api = apiClient ?? WatchApiClient(),
        credentials = credentials ?? SecureCredentialStore(),
        preferences = preferences ?? PreferencesStore(),
        connectivity = connectivity ?? ConnectivityService(),
        vibration = vibration ?? VibrationService(),
        _enablePush = enablePush {
    final creds = this.credentials;
    standaloneAuth = StandaloneAuthService(api: api, credentials: creds);
    pairing = PairingService(
      api: api,
      credentials: creds,
      preferences: this.preferences,
    );
    location = LocationService(
      api: api,
      credentials: creds,
      preferences: this.preferences,
      connectivity: this.connectivity,
    );
    sos = SosService(
      api: api,
      credentials: creds,
      preferences: this.preferences,
      connectivity: this.connectivity,
      location: location,
      vibration: this.vibration,
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
    push = PushMessagingService(alerts: alerts, credentials: creds);
  }

  final WatchApiClient api;
  final SecureCredentialStore credentials;
  final PreferencesStore preferences;
  final ConnectivityService connectivity;
  final VibrationService vibration;
  final bool _enablePush;

  late final StandaloneAuthService standaloneAuth;
  late final PairingService pairing;
  late final LocationService location;
  late final SosService sos;
  late final HeartbeatService heartbeat;
  late final AlertService alerts;
  late final PushMessagingService push;
  DeviceTelemetryService? _telemetry;

  Future<void> initialize({bool firebaseReady = false}) async {
    await standaloneAuth.hydrateApiAuth();
    await pairing.initialize();
    _telemetry = DeviceTelemetryService(
      connectivity: connectivity,
      onBackOnline: watchOfflineReplay(sos),
    );
    await _telemetry!.start();
    await startRuntimeServices(firebaseReady: firebaseReady);
  }

  /// Starts heartbeat / location / optional push without blocking forever on FCM.
  Future<void> startRuntimeServices({
    bool firebaseReady = false,
    Duration pushTimeout = const Duration(seconds: 3),
  }) async {
    heartbeat.start();
    await location.restoreEmergencyTrackingIfNeeded();
    await location.startIdleTracking();
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
