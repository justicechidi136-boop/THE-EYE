import '../api/watch_api_client.dart';
import '../storage/secure_credential_store.dart';

/// Runtime feature flags synced from `/devices/watch/feature-flags`.
class WatchFeatureFlagsService {
  WatchFeatureFlagsService({
    required WatchApiClient api,
    required SecureCredentialStore credentials,
  })  : _api = api,
        _credentials = credentials;

  final WatchApiClient _api;
  final SecureCredentialStore _credentials;

  Map<String, bool> _flags = const {
    'WATCH_SPOKEN_DANGER_ALERTS': true,
    'WATCH_LOCAL_TTS': true,
    'WATCH_ALERT_ACKNOWLEDGEMENT': true,
    'WATCH_STANDALONE_ALERTS': true,
    'WATCH_PHONE_RELAY': true,
    'WATCH_HEADPHONE_PRIVACY': true,
    'WATCH_QUIET_HOURS': true,
    'WATCH_ADMIN_TEST_ALERT': false,
    'WATCH_ADMIN_TELEMETRY': true,
  };

  bool isEnabled(String flag, {bool fallback = true}) =>
      _flags[flag] ?? fallback;

  Future<void> syncFromServer() async {
    final accessToken = await _credentials.readAccessToken();
    if (accessToken == null) return;

    _api.accessToken = accessToken;
    try {
      final response = await _api.get('/devices/watch/feature-flags');
      _flags = response.map(
        (key, value) => MapEntry(key, value == true || value == 'true'),
      );
    } catch (_) {}
  }
}
