import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_field_ops/pairing/pairing_qr_payload.dart';

void main() {
  group('PairingQrPayload.parse — legacy server envelope', () {
    test('accepts the current minimal server envelope {"v":1,"t":"..."}', () {
      final payload = PairingQrPayload.parse(
        jsonEncode({'v': 1, 't': 'raw-token-123'}),
        currentEnvironment: 'staging',
      );
      expect(payload.pairingToken, 'raw-token-123');
      expect(payload.shortCode, isNull);
      expect(payload.hasPairingToken, isTrue);
    });

    test('rejects an unsupported legacy schema version', () {
      expect(
        () => PairingQrPayload.parse(
          jsonEncode({'v': 2, 't': 'raw-token-123'}),
          currentEnvironment: 'staging',
        ),
        throwsA(isA<PairingQrValidationException>()),
      );
    });

    test('rejects a legacy envelope with no token', () {
      expect(
        () => PairingQrPayload.parse(
          jsonEncode({'v': 1}),
          currentEnvironment: 'staging',
        ),
        throwsA(isA<PairingQrValidationException>()),
      );
    });
  });

  group('PairingQrPayload.parse — rich forward-compatible envelope', () {
    Map<String, dynamic> richPayload({
      Object? schemaVersion = 1,
      String? type = 'FIELD_DEVICE_PAIRING',
      String? environment = 'staging',
      String? pairingToken = 'tok-abc',
      String? shortCode,
      String? publicDeviceId,
    }) => {
          'schemaVersion': schemaVersion,
          'type': type,
          if (environment != null) 'environment': environment,
          if (pairingToken != null) 'pairingToken': pairingToken,
          if (shortCode != null) 'shortCode': shortCode,
          if (publicDeviceId != null) 'publicDeviceId': publicDeviceId,
        };

    test('accepts a matching schemaVersion/type/environment', () {
      final payload = PairingQrPayload.parse(
        jsonEncode(richPayload(publicDeviceId: 'fd_123')),
        currentEnvironment: 'staging',
      );
      expect(payload.pairingToken, 'tok-abc');
      expect(payload.publicDeviceId, 'fd_123');
    });

    test('environment comparison is case-insensitive', () {
      final payload = PairingQrPayload.parse(
        jsonEncode(richPayload(environment: 'STAGING')),
        currentEnvironment: 'staging',
      );
      expect(payload.pairingToken, 'tok-abc');
    });

    test('rejects a payload issued for a different environment', () {
      expect(
        () => PairingQrPayload.parse(
          jsonEncode(richPayload(environment: 'production')),
          currentEnvironment: 'staging',
        ),
        throwsA(
          isA<PairingQrValidationException>().having(
            (e) => e.message,
            'message',
            contains('production'),
          ),
        ),
      );
    });

    test('rejects an unsupported schemaVersion', () {
      expect(
        () => PairingQrPayload.parse(
          jsonEncode(richPayload(schemaVersion: 2)),
          currentEnvironment: 'staging',
        ),
        throwsA(isA<PairingQrValidationException>()),
      );
    });

    test('rejects a non-pairing QR type', () {
      expect(
        () => PairingQrPayload.parse(
          jsonEncode(richPayload(type: 'SOMETHING_ELSE')),
          currentEnvironment: 'staging',
        ),
        throwsA(isA<PairingQrValidationException>()),
      );
    });

    test('accepts a shortCode-only rich payload', () {
      final payload = PairingQrPayload.parse(
        jsonEncode(richPayload(pairingToken: null, shortCode: 'EYE-4F7K-92MZ')),
        currentEnvironment: 'staging',
      );
      expect(payload.hasPairingToken, isFalse);
      expect(payload.shortCode, 'EYE-4F7K-92MZ');
    });
  });

  group('PairingQrPayload.parse — malformed input', () {
    test('rejects empty input', () {
      expect(
        () => PairingQrPayload.parse('', currentEnvironment: 'staging'),
        throwsA(isA<PairingQrValidationException>()),
      );
    });

    test('rejects non-JSON input', () {
      expect(
        () => PairingQrPayload.parse(
          'not-json-at-all',
          currentEnvironment: 'staging',
        ),
        throwsA(isA<PairingQrValidationException>()),
      );
    });

    test('rejects a JSON array', () {
      expect(
        () => PairingQrPayload.parse('[1,2,3]', currentEnvironment: 'staging'),
        throwsA(isA<PairingQrValidationException>()),
      );
    });

    test('never trusts unrelated fields such as "permissions"', () {
      final payload = PairingQrPayload.parse(
        jsonEncode({
          'v': 1,
          't': 'tok-abc',
          'permissions': ['field:admin:everything'],
          'role': 'Supervisor',
        }),
        currentEnvironment: 'staging',
      );
      // PairingQrPayload has no field to carry permissions/role at all —
      // this test documents that the parser structurally cannot leak them.
      expect(payload.pairingToken, 'tok-abc');
    });
  });

  group('PairingShortCode', () {
    test('normalize trims and uppercases without reformatting', () {
      expect(PairingShortCode.normalize(' eye-4f7k-92mz '), 'EYE-4F7K-92MZ');
    });

    test('format adds EYE- prefix and dash for raw characters', () {
      expect(PairingShortCode.format('4f7k92mz'), 'EYE-4F7K-92MZ');
    });

    test('format strips an existing EYE prefix before reformatting', () {
      expect(PairingShortCode.format('EYE4F7K92MZ'), 'EYE-4F7K-92MZ');
      expect(PairingShortCode.format('eye-4f7k-92mz'), 'EYE-4F7K-92MZ');
    });

    test('format ignores stray punctuation and whitespace', () {
      expect(PairingShortCode.format('eye 4f7k-92mz!!'), 'EYE-4F7K-92MZ');
    });

    test('format truncates to 8 body characters', () {
      expect(PairingShortCode.format('EYE4F7K92MZEXTRA'), 'EYE-4F7K-92MZ');
    });

    test('format handles partial input while typing', () {
      expect(PairingShortCode.format(''), 'EYE-');
      expect(PairingShortCode.format('4'), 'EYE-4');
      expect(PairingShortCode.format('4f7k'), 'EYE-4F7K');
      expect(PairingShortCode.format('4f7k9'), 'EYE-4F7K-9');
    });

    test('isValid accepts a well-formed code', () {
      expect(PairingShortCode.isValid('EYE-4F7K-92MZ'), isTrue);
      expect(PairingShortCode.isValid('eye-4f7k-92mz'), isTrue);
    });

    test('isValid rejects ambiguous characters excluded from the alphabet', () {
      // 0 / O / 1 / I / L are intentionally excluded from
      // FIELD_PAIRING_SHORT_CODE_ALPHABET on the server.
      expect(PairingShortCode.isValid('EYE-0000-0000'), isFalse);
      expect(PairingShortCode.isValid('EYE-O11L-92MZ'), isFalse);
    });

    test('isValid rejects wrong-length or malformed codes', () {
      expect(PairingShortCode.isValid('EYE-4F7-92MZ'), isFalse);
      expect(PairingShortCode.isValid('EYE-4F7K92MZ'), isFalse);
      expect(PairingShortCode.isValid(''), isFalse);
    });
  });
}
