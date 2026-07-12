import '../api/watch_api_client.dart';
import '../api/watch_api_paths.dart';
import '../storage/secure_credential_store.dart';

class StandaloneAuthService {
  StandaloneAuthService({
    required WatchApiClient api,
    required SecureCredentialStore credentials,
  })  : _api = api,
        _credentials = credentials;

  final WatchApiClient _api;
  final SecureCredentialStore _credentials;

  Future<bool> loginWithActivationCode({
    required String activationCode,
    String? deviceCertificate,
  }) async {
    final deviceId = await _credentials.readDeviceId();
    if (deviceId == null || deviceId.isEmpty) {
      throw StateError('Device ID is required before standalone login');
    }

    final response = await _api.post(
      WatchApiPaths.standaloneLogin,
      body: {
        'deviceId': deviceId,
        'deviceSecret': activationCode,
        if (deviceCertificate != null) 'deviceCertificate': deviceCertificate,
      },
    );

    final token = response['accessToken'] as String?;
    if (token == null || token.isEmpty) return false;

    await _credentials.saveAccessToken(token);
    await _credentials.saveDeviceCredentials(
      deviceId: deviceId,
      deviceSecret: activationCode,
    );
    _api.accessToken = token;
    _api.deviceSecret = activationCode;
    return true;
  }

  Future<void> hydrateApiAuth() async {
    _api.accessToken = await _credentials.readAccessToken();
    _api.deviceSecret = await _credentials.readDeviceSecret();
  }
}
