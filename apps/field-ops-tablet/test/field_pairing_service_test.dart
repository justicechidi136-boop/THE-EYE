import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_field_ops/api/field_api_client.dart';
import 'package:the_eye_field_ops/api/field_api_paths.dart';
import 'package:the_eye_field_ops/auth/field_auth_service.dart';
import 'package:the_eye_field_ops/pairing/field_pairing_service.dart';
import 'package:the_eye_field_ops/screens/routes.dart';
import 'package:the_eye_field_ops/security/device_keystore_service.dart';

class _RecordingClient extends FieldApiClient {
  _RecordingClient({required this.handler})
      : super(baseUrl: 'http://127.0.0.1:4000/v1', skipEnvGuard: true);

  final Future<Map<String, dynamic>> Function(
    String method,
    String path,
    Map<String, dynamic>? body,
    Map<String, String>? query,
  ) handler;

  String? lastMethod;
  String? lastPath;
  Map<String, dynamic>? lastBody;
  Map<String, String>? lastQuery;

  @override
  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? headers,
    Map<String, String>? query,
  }) async {
    lastMethod = 'GET';
    lastPath = path;
    lastQuery = query;
    return handler('GET', path, null, query);
  }

  @override
  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? headers,
    Map<String, String>? query,
  }) async {
    lastMethod = 'POST';
    lastPath = path;
    lastBody = body;
    return handler('POST', path, body, query);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('field pairing routes and API paths are registered', () {
    expect(FieldRoutes.pairDevice, '/pair-device');
    expect(FieldApiPaths.pairingClaim, '/field/pairing/claim');
    expect(FieldApiPaths.pairingChallenge, '/field/pairing/challenge');
    expect(FieldApiPaths.pairingComplete, '/field/pairing/complete');
    expect(FieldApiPaths.pairingStatus, '/field/pairing/status');
  });

  test('claim posts pairingToken/shortCode and parses confirmation info', () async {
    final client = _RecordingClient(
      handler: (method, path, body, query) async => {
        'data': {
          'publicDeviceId': 'fd_ab12cd34',
          'deviceName': 'Patrol Tablet 07',
          'operationalRole': 'PatrolOfficer',
          'expiresAt': '2026-08-10T15:00:00.000Z',
        },
      },
    );
    final service = FieldPairingService(
      api: client,
      keystore: DeviceKeystoreService(memory: {}),
    );

    final result = await service.claim(
      const FieldPairingLookup(pairingToken: 'raw-token'),
    );

    expect(client.lastPath, '/field/pairing/claim');
    expect(client.lastBody, {'pairingToken': 'raw-token'});
    expect(result.publicDeviceId, 'fd_ab12cd34');
    expect(result.deviceName, 'Patrol Tablet 07');
    expect(result.operationalRole, 'PatrolOfficer');
  });

  test('claim with shortCode only sends shortCode and omits pairingToken', () async {
    final client = _RecordingClient(
      handler: (method, path, body, query) async => {
        'data': {
          'publicDeviceId': 'fd_ab12cd34',
          'deviceName': 'Patrol Tablet 07',
          'expiresAt': '2026-08-10T15:00:00.000Z',
        },
      },
    );
    final service = FieldPairingService(
      api: client,
      keystore: DeviceKeystoreService(memory: {}),
    );

    await service.claim(const FieldPairingLookup(shortCode: 'EYE-4F7K-92MZ'));

    expect(client.lastBody, {'shortCode': 'EYE-4F7K-92MZ'});
    expect(client.lastBody!.containsKey('pairingToken'), isFalse);
  });

  test('requestChallenge signs the returned challenge with the device key', () async {
    final memory = <String, String>{};
    final keystore = DeviceKeystoreService(memory: memory);
    await keystore.ensureKeyPair();

    final client = _RecordingClient(
      handler: (method, path, body, query) async => {
        'data': {'challengeId': 'chal-1', 'challenge': 'nonce-xyz'},
      },
    );
    final service = FieldPairingService(api: client, keystore: keystore);

    final challenge = await service.requestChallenge(
      const FieldPairingLookup(pairingToken: 'raw-token'),
    );

    expect(client.lastPath, '/field/pairing/challenge');
    expect(challenge.challengeId, 'chal-1');
    expect(challenge.challenge, 'nonce-xyz');
    expect(challenge.challengeSignature, isNotEmpty);
    // Signature must be verifiable against the same challenge string.
    final expectedSignature = await keystore.signChallenge('nonce-xyz');
    expect(challenge.challengeSignature, expectedSignature);
  });

  test('complete sends device metadata, publicKey, and package/environment', () async {
    Map<String, dynamic>? capturedBody;
    final client = _RecordingClient(
      handler: (method, path, body, query) async {
        capturedBody = body;
        return {
          'data': {
            'publicDeviceId': 'fd_ab12cd34',
            'registrationStatus': 'PendingApproval',
            'preProvisionStatus': 'AwaitingFinalApproval',
            'requiresFinalApproval': true,
          },
        };
      },
    );
    final service = FieldPairingService(
      api: client,
      keystore: DeviceKeystoreService(memory: {}),
    );

    const signedChallenge = FieldChallenge(
      challengeId: 'chal-1',
      challenge: 'nonce-xyz',
      challengeSignature: 'sig-abc',
    );

    final result = await service.complete(
      const FieldPairingLookup(shortCode: 'EYE-4F7K-92MZ'),
      signedChallenge: signedChallenge,
      publicKey: 'pubkey-base64',
      installationIdHash: 'hash-base64',
      deviceName: 'Patrol Tablet 07',
    );

    expect(client.lastPath, '/field/pairing/complete');
    expect(capturedBody!['shortCode'], 'EYE-4F7K-92MZ');
    expect(capturedBody!['challengeId'], 'chal-1');
    expect(capturedBody!['challengeSignature'], 'sig-abc');
    expect(capturedBody!['publicKey'], 'pubkey-base64');
    expect(capturedBody!['installationIdHash'], 'hash-base64');
    expect(capturedBody!['deviceName'], 'Patrol Tablet 07');
    expect(capturedBody!.containsKey('packageName'), isTrue);
    expect(capturedBody!.containsKey('appEnvironment'), isTrue);

    expect(result.registrationStatus, 'PendingApproval');
    expect(result.requiresFinalApproval, isTrue);
    expect(result.isActive, isFalse);
    expect(result.isPendingApproval, isTrue);
  });

  test('status maps attemptsRemaining and expiry from a GET request', () async {
    final client = _RecordingClient(
      handler: (method, path, body, query) async => {
        'data': {
          'status': 'Claimed',
          'expiresAt': '2026-08-10T15:00:00.000Z',
          'attemptsRemaining': 3,
        },
      },
    );
    final service = FieldPairingService(
      api: client,
      keystore: DeviceKeystoreService(memory: {}),
    );

    final status = await service.status(
      const FieldPairingLookup(pairingToken: 'raw-token'),
    );

    expect(client.lastMethod, 'GET');
    expect(client.lastQuery, {'pairingToken': 'raw-token'});
    expect(status.status, 'Claimed');
    expect(status.attemptsRemaining, 3);
  });
}
