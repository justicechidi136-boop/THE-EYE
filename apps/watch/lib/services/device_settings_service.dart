import '../api/watch_api_client.dart';
import '../api/watch_api_paths.dart';
import '../storage/secure_credential_store.dart';
import '../storage/watch_settings_store.dart';

class DeviceSettingsService {
  DeviceSettingsService({
    required WatchApiClient api,
    required SecureCredentialStore credentials,
    required WatchSettingsStore settings,
  })  : _api = api,
        _credentials = credentials,
        _settings = settings;

  final WatchApiClient _api;
  final SecureCredentialStore _credentials;
  final WatchSettingsStore _settings;

  Future<WatchSettings> syncFromServer() async {
    final local = await _settings.load();
    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    if (deviceId == null || deviceSecret == null) return local;

    try {
      final response = await _api.get(
        WatchApiPaths.deviceSettings(deviceId),
        query: {'deviceSecret': deviceSecret},
      );
      final data = response['data'] as Map<String, dynamic>? ?? {};
      final policy = data['policy'] as Map<String, dynamic>?;
      final merged = _settings.mergePolicy(
        local.copyWith(
          deviceDisplayName: data['displayName'] as String?,
          preferredConnectionMode:
              _normalizeConnection(data['connectionPreference'] as String?),
          sosCountdownSeconds:
              (data['sosCountdownSeconds'] as num?)?.toInt() ?? local.sosCountdownSeconds,
          criticalAlertsEnabled:
              data['criticalAlertsEnabled'] as bool? ?? local.criticalAlertsEnabled,
        ),
        WatchServerPolicy.fromJson(policy),
      );
      await _settings.save(merged);
      return merged;
    } catch (_) {
      return local;
    }
  }

  Future<void> pushSyncedFields(WatchSettings local) async {
    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    if (deviceId == null || deviceSecret == null) return;

    await _api.patch(
      WatchApiPaths.deviceSettings(deviceId),
      body: {
        'deviceSecret': deviceSecret,
        if (local.deviceDisplayName != null) 'displayName': local.deviceDisplayName,
        'connectionPreference': _toApiConnection(local.preferredConnectionMode),
        'sosCountdownSeconds': local.sosCountdownSeconds,
        'criticalAlertsEnabled': local.criticalAlertsEnabled,
      },
    );
  }

  String _normalizeConnection(String? value) {
    if (value == null) return 'pairedPhone';
    final normalized = value.replaceAll('_', '').toLowerCase();
    if (normalized.contains('standalone')) return 'standaloneCellular';
    return 'pairedPhone';
  }

  String _toApiConnection(String value) {
    return value == 'standaloneCellular' ? 'StandaloneCellular' : 'PairedPhone';
  }
}
