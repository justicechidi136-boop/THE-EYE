import 'dart:convert';

import 'package:cryptography/cryptography.dart';

import '../alerts/danger_alert_models.dart';
import '../alerts/danger_alert_public_keys.dart';

const _maxClockSkew = Duration(minutes: 5);

class DangerAlertSignatureVerifier {
  DangerAlertSignatureVerifier({Ed25519? algorithm})
      : _ed25519 = algorithm ?? Ed25519();

  final Ed25519 _ed25519;

  Future<DangerAlertVerifyResult> verify(DangerAlertPayload payload) async {
    final signature = payload.signature;
    if (signature == null || signature.isEmpty) {
      return DangerAlertVerifyResult.invalid('missing_signature');
    }
    if (payload.schemaVersion != 1) {
      return DangerAlertVerifyResult.invalid('unsupported_schema');
    }

    final keyId = payload.signatureKeyId;
    if (keyId == null || keyId.isEmpty) {
      return DangerAlertVerifyResult.invalid('missing_signature');
    }
    final publicKeyPem = DangerAlertPublicKeys.resolve(keyId);
    if (publicKeyPem == null) {
      return DangerAlertVerifyResult.invalid('unknown_key');
    }

    final issuedAt = payload.issuedAt.toUtc();
    final now = DateTime.now().toUtc();
    if (issuedAt.isAfter(now.add(_maxClockSkew))) {
      return DangerAlertVerifyResult.invalid('issued_at_future');
    }
    if (payload.isExpired) {
      return DangerAlertVerifyResult.invalid('expired');
    }

    final message = _buildSigningMessage(payload);
    try {
      final publicKey = await _parsePublicKey(publicKeyPem);
      final sigBytes = base64Url.decode(_padBase64Url(signature));
      final valid = await _ed25519.verify(
        utf8.encode(message),
        signature: Signature(sigBytes, publicKey: publicKey),
      );
      return valid
          ? DangerAlertVerifyResult.valid()
          : DangerAlertVerifyResult.invalid('invalid_signature');
    } catch (_) {
      return DangerAlertVerifyResult.invalid('invalid_signature');
    }
  }

  String _buildSigningMessage(DangerAlertPayload payload) {
    return jsonEncode({
      'schemaVersion': payload.schemaVersion,
      'alertId': payload.alertId,
      'version': payload.version,
      'sequence': payload.sequence,
      'state': payload.lifecycleState.wireValue,
      'alertCode': payload.alertCode,
      'priority': _priorityLabel(payload.priority),
      'issuedAt': payload.issuedAtWire,
      'expiresAt': payload.expiresAt?.toUtc().toIso8601String() ?? '',
      'zoneId': payload.zoneId,
      'distanceMeters': payload.distanceMeters,
      'areaName': payload.areaName ?? '',
    });
  }

  String _priorityLabel(DangerAlertPriority priority) => switch (priority) {
        DangerAlertPriority.critical => 'CRITICAL',
        DangerAlertPriority.high => 'HIGH',
        DangerAlertPriority.medium => 'MEDIUM',
        DangerAlertPriority.low => 'LOW',
      };

  Future<SimplePublicKey> _parsePublicKey(String pem) async {
    final lines = pem
        .replaceAll('-----BEGIN PUBLIC KEY-----', '')
        .replaceAll('-----END PUBLIC KEY-----', '')
        .replaceAll('\r', '')
        .replaceAll('\n', '')
        .trim();
    final der = base64.decode(lines);
    return SimplePublicKey(der.sublist(der.length - 32), type: KeyPairType.ed25519);
  }

  String _padBase64Url(String value) {
    final mod = value.length % 4;
    if (mod == 0) return value;
    return value + '=' * (4 - mod);
  }
}

class DangerAlertVerifyResult {
  const DangerAlertVerifyResult._({required this.valid, this.reason});

  factory DangerAlertVerifyResult.valid() =>
      const DangerAlertVerifyResult._(valid: true);

  factory DangerAlertVerifyResult.invalid(String reason) =>
      DangerAlertVerifyResult._(valid: false, reason: reason);

  final bool valid;
  final String? reason;
}
