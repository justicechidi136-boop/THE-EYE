import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_field_ops/api/field_api_client.dart';
import 'package:the_eye_field_ops/auth/field_auth_service.dart';
import 'package:the_eye_field_ops/security/device_keystore_service.dart';
import 'package:the_eye_field_ops/security/secure_session_store.dart';

class _RefreshClient extends FieldApiClient {
  _RefreshClient()
    : super(
        baseUrl: 'https://staging-api.theeye.com.ng/v1',
        skipEnvGuard: true,
      );

  @override
  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? headers,
    Map<String, String>? query,
  }) async {
    return {
      'data': {
        'accessToken': 'new-access',
        'expiresIn': 900,
        'sessionId': 'session-1',
      },
    };
  }
}

void main() {
  test('device keystore signs challenges', () async {
    final memory = <String, String>{};
    final keystore = DeviceKeystoreService(memory: memory);
    await keystore.ensureKeyPair();

    final signature = await keystore.signChallenge('test-challenge');
    expect(signature, isNotEmpty);

    final publicKey = await keystore.readPublicKeyBase64();
    expect(publicKey, isNotEmpty);
  });

  test('installation id hash is stable', () async {
    final hash = await FieldAuthService.hashInstallationId('install-123');
    expect(hash, await FieldAuthService.hashInstallationId('install-123'));
    expect(
      hash,
      isNot(equals(await FieldAuthService.hashInstallationId('other'))),
    );
  });

  test('secure session store persists tokens in memory', () async {
    final memory = <String, String>{};
    final session = SecureSessionStore(memory: memory);
    await session.saveSession(
      accessToken: 'access',
      refreshToken: 'refresh',
      sessionId: 'session',
      publicDeviceId: 'fd_test',
      officerName: 'Officer A',
    );

    expect(await session.readAccessToken(), 'access');
    expect(await session.readPublicDeviceId(), 'fd_test');
    expect(await session.readOfficerName(), 'Officer A');
  });

  test(
    'refresh preserves stored identity when API returns token-only data',
    () async {
      final memory = <String, String>{};
      final session = SecureSessionStore(memory: memory);
      await session.saveSession(
        accessToken: 'old-access',
        refreshToken: 'existing-refresh',
        sessionId: 'session-1',
        publicDeviceId: 'fd_test',
        officerId: 'officer-1',
        officerName: 'Officer A',
        preferredLocale: 'en',
      );
      final api = _RefreshClient();
      final auth = FieldAuthService(
        api: api,
        session: session,
        keystore: DeviceKeystoreService(memory: {}),
      );

      final result = await auth.refreshSession();

      expect(result.accessToken, 'new-access');
      expect(result.refreshToken, 'existing-refresh');
      expect(result.publicDeviceId, 'fd_test');
      expect(result.officerName, 'Officer A');
      expect(await session.readRefreshToken(), 'existing-refresh');
      expect(await session.readPublicDeviceId(), 'fd_test');
      api.dispose();
    },
  );
}
