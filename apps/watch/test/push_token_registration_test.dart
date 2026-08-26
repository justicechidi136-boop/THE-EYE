import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:the_eye_watch/api/watch_api_client.dart';
import 'package:the_eye_watch/api/watch_api_paths.dart';
import 'package:the_eye_watch/services/alert_service.dart';
import 'package:the_eye_watch/storage/secure_credential_store.dart';

class _RecordingWatchApiClient extends WatchApiClient {
  _RecordingWatchApiClient()
      : super(skipEnvGuard: true, baseUrl: 'http://127.0.0.1:4000/v1');

  final calls = <({String path, Map<String, dynamic>? body})>[];

  @override
  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? headers,
  }) async {
    calls.add((path: path, body: body));
    return <String, dynamic>{};
  }
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  test('registers a token captured before watch authentication', () async {
    final credentials = SecureCredentialStore(memory: <String, String>{});
    final api = _RecordingWatchApiClient();
    final alerts = AlertService(
      api: api,
      credentials: credentials,
      preferences: PreferencesStore(),
    );

    await alerts.registerPushToken('watch-fcm-token');

    expect(await credentials.readPushToken(), 'watch-fcm-token');
    expect(api.calls, isEmpty);

    await credentials.saveAccessToken('watch-access-token');
    await credentials.saveDeviceCredentials(
      deviceId: 'watch-device-1',
      deviceSecret: 'device-secret',
    );

    expect(await alerts.retryStoredPushTokenRegistration(), isTrue);
    expect(api.calls.length, 1);
    expect(api.calls.single.path, WatchApiPaths.pushTokens);
    expect(api.calls.single.body?['platform'], 'android_watch');
    expect(api.calls.single.body?['deviceId'], 'watch-device-1');
  });

  test('does not register a stored token without authentication', () async {
    final credentials = SecureCredentialStore(memory: <String, String>{});
    final api = _RecordingWatchApiClient();
    final alerts = AlertService(
      api: api,
      credentials: credentials,
      preferences: PreferencesStore(),
    );
    await credentials.savePushToken('watch-fcm-token');

    expect(await alerts.retryStoredPushTokenRegistration(), isFalse);
    expect(api.calls, isEmpty);
  });
}
