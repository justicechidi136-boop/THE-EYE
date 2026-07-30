/// Embedded Ed25519 public keys for danger-alert signature verification.
/// Private keys remain backend-only. Rotate by adding overlapping keyIds.
abstract final class DangerAlertPublicKeys {
  static const stagingV1 = '''
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAzMdKIXGFfMS5yxTJ7zwJwu/jRDOtPX/l8j9EXSdvC00=
-----END PUBLIC KEY-----''';

  static const keysById = <String, String>{
    'staging-v1': stagingV1,
    'test-v1': stagingV1,
  };

  static String? resolve(String keyId) => keysById[keyId];
}
