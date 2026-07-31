import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/api/watch_api_client.dart';
import 'package:the_eye_watch/api/watch_api_paths.dart';
import 'package:the_eye_watch/models/standalone_activation_result.dart';
import 'package:the_eye_watch/services/standalone_auth_service.dart';
import 'package:the_eye_watch/services/watch_activation_exception.dart';
import 'package:the_eye_watch/storage/secure_credential_store.dart';

class _FakeWatchApiClient extends WatchApiClient {
  _FakeWatchApiClient({
    required this.handler,
  }) : super(skipEnvGuard: true, baseUrl: 'http://127.0.0.1:4000/v1');

  final Future<Map<String, dynamic>> Function(String path, Map<String, dynamic>? body) handler;

  @override
  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? headers,
  }) {
    return handler(path, body);
  }
}

Map<String, dynamic> _validActivationResponse() {
  return {
    'status': 'activated',
    'correlationId': 'corr-1',
    'watch': {
      'id': 'watch-internal-1',
      'deviceId': 'EYE-WATCH-001',
      'pairingStatus': 'ACTIVE',
    },
    'owner': {'id': 'owner-1', 'type': 'PERSON'},
    'authentication': {
      'accessToken': 'ey.test.token',
      'refreshToken': null,
      'expiresAt': '2026-07-31T12:00:00.000Z',
    },
    'deviceSecret': 'device-secret-value',
  };
}

void main() {
  group('StandaloneActivationResult', () {
    test('parses valid activation response', () {
      final parsed = StandaloneActivationResult.fromJson(_validActivationResponse());
      expect(parsed.deviceId, 'EYE-WATCH-001');
      expect(parsed.accessToken, 'ey.test.token');
      expect(parsed.deviceSecret, 'device-secret-value');
    });

    test('rejects missing token', () {
      final payload = _validActivationResponse();
      (payload['authentication'] as Map<String, dynamic>).remove('accessToken');
      expect(
        () => StandaloneActivationResult.fromJson(payload),
        throwsFormatException,
      );
    });

    test('rejects missing device secret', () {
      final payload = _validActivationResponse()..remove('deviceSecret');
      expect(
        () => StandaloneActivationResult.fromJson(payload),
        throwsFormatException,
      );
    });
  });

  group('StandaloneAuthService.activateWithAdminCode', () {
    test('persists credentials on successful activation', () async {
      final memory = <String, String>{};
      final credentials = SecureCredentialStore(memory: memory);
      final api = _FakeWatchApiClient(
        handler: (path, body) async {
          expect(path, WatchApiPaths.activateWithCode);
          expect(body?['deviceId'], 'EYE-WATCH-001');
          expect(body?['pairingCode'], '123456');
          return _validActivationResponse();
        },
      );
      final service = StandaloneAuthService(api: api, credentials: credentials);

      final result = await service.activateWithAdminCode(
        deviceId: 'EYE-WATCH-001',
        pairingCode: '123456',
      );

      expect(result.deviceId, 'EYE-WATCH-001');
      expect(await credentials.readDeviceId(), 'EYE-WATCH-001');
      expect(await credentials.readDeviceSecret(), 'device-secret-value');
      expect(await credentials.readAccessToken(), 'ey.test.token');
      expect(await credentials.isActivationComplete(), isTrue);
    });

    test('maps HTTP 401 to invalid activation code', () async {
      final credentials = SecureCredentialStore(memory: {});
      final api = _FakeWatchApiClient(
        handler: (_, __) async {
          throw WatchApiException('Invalid activation code', statusCode: 401);
        },
      );
      final service = StandaloneAuthService(api: api, credentials: credentials);

      expect(
        () => service.activateWithAdminCode(
          deviceId: 'EYE-WATCH-001',
          pairingCode: '123456',
        ),
        throwsA(isA<WatchActivationException>().having(
          (e) => e.code,
          'code',
          'WATCH-ACTIVATION-001',
        )),
      );
    });

    test('rejects non-6-digit codes before network call', () async {
      final credentials = SecureCredentialStore(memory: {});
      var called = false;
      final api = _FakeWatchApiClient(
        handler: (_, __) async {
          called = true;
          return _validActivationResponse();
        },
      );
      final service = StandaloneAuthService(api: api, credentials: credentials);

      expect(
        () => service.activateWithAdminCode(
          deviceId: 'EYE-WATCH-001',
          pairingCode: 'abc',
        ),
        throwsA(isA<WatchActivationException>()),
      );
      expect(called, isFalse);
    });

    test('surfaces malformed response as parse error', () async {
      final credentials = SecureCredentialStore(memory: {});
      final api = _FakeWatchApiClient(
        handler: (_, __) async => {'status': 'activated'},
      );
      final service = StandaloneAuthService(api: api, credentials: credentials);

      expect(
        () => service.activateWithAdminCode(
          deviceId: 'EYE-WATCH-001',
          pairingCode: '123456',
        ),
        throwsA(isA<WatchActivationException>().having(
          (e) => e.code,
          'code',
          'WATCH-ACTIVATION-004',
        )),
      );
    });
  });
}
