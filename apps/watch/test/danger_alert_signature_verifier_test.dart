import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/alerts/danger_alert_models.dart';
import 'package:the_eye_watch/services/danger_alert_signature_verifier.dart';

/// Deterministic test vector — private key is CI-only; public key embedded in DangerAlertPublicKeys.
const _testPrivateKeyPem = '''
-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIPUJRR6gwejwp8VJDCmq7Nxgpre7bcu7hHgOSl2At7Uo
-----END PRIVATE KEY-----''';

void main() {
  group('DangerAlertSignatureVerifier', () {
    test('verifies backend-compatible Ed25519 signatures', () async {
      const issuedAt = '2026-07-30T12:00:00.000Z';
      final message = jsonEncode({
        'schemaVersion': 1,
        'alertId': 'alert-zone-1-user-1-mobile',
        'version': 1,
        'sequence': 1,
        'state': 'ACTIVE',
        'alertCode': DangerAlertCodes.generalEntry,
        'priority': 'MEDIUM',
        'issuedAt': issuedAt,
        'expiresAt': '',
        'zoneId': 'zone-1',
        'distanceMeters': null,
        'areaName': '',
      });

      final ed25519 = Ed25519();
      final privateKey = await _loadPrivateKey(_testPrivateKeyPem);
      final signature = await ed25519.sign(utf8.encode(message), keyPair: privateKey);

      final payload = DangerAlertPayload(
        schemaVersion: 1,
        alertId: 'alert-zone-1-user-1-mobile',
        version: 1,
        sequence: 1,
        lifecycleState: DangerAlertLifecycleState.active,
        alertCode: DangerAlertCodes.generalEntry,
        priority: DangerAlertPriority.medium,
        incidentId: 'inc-1',
        zoneId: 'zone-1',
        safetyAlertId: 'sa-1',
        issuedAt: DateTime.parse(issuedAt).toUtc(),
        issuedAtWire: issuedAt,
        signature: base64Url.encode(signature.bytes).replaceAll('=', ''),
        signatureKeyId: 'test-v1',
      );

      final result = await DangerAlertSignatureVerifier().verify(payload);
      expect(result.valid, isTrue);
    });

    test('rejects tampered payloads', () async {
      const issuedAt = '2026-07-30T12:00:00.000Z';
      final payload = DangerAlertPayload(
        schemaVersion: 1,
        alertId: 'alert-zone-1-user-1-mobile',
        version: 1,
        sequence: 1,
        lifecycleState: DangerAlertLifecycleState.active,
        alertCode: DangerAlertCodes.generalEntry,
        priority: DangerAlertPriority.high,
        incidentId: 'inc-1',
        zoneId: 'zone-1',
        safetyAlertId: 'sa-1',
        issuedAt: DateTime.parse(issuedAt).toUtc(),
        issuedAtWire: issuedAt,
        signature: 'invalid',
        signatureKeyId: 'test-v1',
      );

      final result = await DangerAlertSignatureVerifier().verify(payload);
      expect(result.valid, isFalse);
      expect(result.reason, 'invalid_signature');
    });
  });
}

Future<SimpleKeyPair> _loadPrivateKey(String pem) async {
  final lines = pem
      .replaceAll('-----BEGIN PRIVATE KEY-----', '')
      .replaceAll('-----END PRIVATE KEY-----', '')
      .replaceAll('\r', '')
      .replaceAll('\n', '')
      .trim();
  final der = base64.decode(lines);
  final seed = der.sublist(der.length - 32);
  return SimpleKeyPairData(seed, publicKey: SimplePublicKey([], type: KeyPairType.ed25519), type: KeyPairType.ed25519);
}
