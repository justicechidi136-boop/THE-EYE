import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_field_ops/auth/field_auth_service.dart';
import 'package:the_eye_field_ops/security/device_keystore_service.dart';
import 'package:the_eye_field_ops/security/secure_session_store.dart';

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
    expect(hash, isNot(equals(await FieldAuthService.hashInstallationId('other'))));
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
}
