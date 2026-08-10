import 'dart:convert';

/// Raised when a scanned/pasted pairing QR payload is malformed, from an
/// unsupported schema version, not a field-pairing code, or issued for a
/// different app environment. The [message] is safe to show directly to an
/// officer.
class PairingQrValidationException implements Exception {
  const PairingQrValidationException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Parsed & validated contents of a Field Device Pairing QR code.
///
/// The admin API currently issues a minimal envelope
/// (`{"v":1,"t":"<pairingToken>"}` — see
/// `FieldDevicePairingService.issueOrRegenerate` in
/// `apps/api/src/modules/field-operations/field-device-pairing.service.ts`
/// and `docs/FIELD_DEVICE_PAIRING.md`). This parser also accepts a richer,
/// forward-compatible envelope (`schemaVersion`/`type`/`environment`/
/// `pairingToken`/`shortCode`/`publicDeviceId`) so future admin tooling can
/// embed more context without breaking older tablet builds.
///
/// Critically: **the QR code is never trusted for anything except locating
/// which single-use pairing token/short code to claim.** No permission,
/// role, or activation-state information is ever taken from the QR — the
/// device name/role shown to the officer for confirmation, and the eventual
/// registration/activation status, always come from the server responses to
/// `claim()` / `complete()`.
class PairingQrPayload {
  const PairingQrPayload({
    required this.pairingToken,
    this.shortCode,
    this.publicDeviceId,
  });

  /// Schema version this client understands. Bump alongside any breaking
  /// change to the richer envelope; the legacy `{"v":1,"t":...}` envelope is
  /// versioned independently but currently shares the same value.
  static const supportedSchemaVersion = 1;
  static const expectedType = 'FIELD_DEVICE_PAIRING';

  final String pairingToken;
  final String? shortCode;
  final String? publicDeviceId;

  bool get hasPairingToken => pairingToken.isNotEmpty;

  /// Parses raw QR text (or any pasted JSON payload) and validates it.
  ///
  /// [currentEnvironment] should be `AppFlavor.envName` ('staging' /
  /// 'production'); when the payload declares an `environment` that does not
  /// match, parsing fails loudly rather than silently pairing a tablet
  /// against the wrong backend.
  factory PairingQrPayload.parse(
    String raw, {
    required String currentEnvironment,
  }) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) {
      throw const PairingQrValidationException('QR code is empty.');
    }

    final Map<String, dynamic> json;
    try {
      final decoded = jsonDecode(trimmed);
      if (decoded is! Map) {
        throw const FormatException('not a JSON object');
      }
      json = Map<String, dynamic>.from(decoded);
    } on FormatException {
      throw const PairingQrValidationException(
        'This QR code is not a THE EYE field pairing code.',
      );
    }

    final declaresRichEnvelope =
        json.containsKey('type') || json.containsKey('schemaVersion');

    if (declaresRichEnvelope) {
      return _parseRichEnvelope(json, currentEnvironment: currentEnvironment);
    }
    return _parseLegacyEnvelope(json);
  }

  static PairingQrPayload _parseRichEnvelope(
    Map<String, dynamic> json, {
    required String currentEnvironment,
  }) {
    final schemaVersion = json['schemaVersion'] ?? json['v'];
    if (schemaVersion != supportedSchemaVersion) {
      throw PairingQrValidationException(
        'Unsupported pairing QR version (${schemaVersion ?? 'unknown'}). '
        'Update the app or ask your supervisor to re-issue the code.',
      );
    }

    final type = json['type']?.toString();
    if (type != expectedType) {
      throw const PairingQrValidationException(
        'This QR code is not a field device pairing code.',
      );
    }

    final environment = json['environment']?.toString();
    if (environment != null &&
        environment.isNotEmpty &&
        environment.toLowerCase() != currentEnvironment.toLowerCase()) {
      throw PairingQrValidationException(
        'This pairing code was issued for the "$environment" environment, '
        'but this tablet is running "$currentEnvironment". Install the '
        'matching build before pairing.',
      );
    }

    final token = (json['pairingToken'] ?? json['token'] ?? json['t'])
        ?.toString();
    final shortCode = json['shortCode']?.toString();
    if ((token == null || token.isEmpty) &&
        (shortCode == null || shortCode.isEmpty)) {
      throw const PairingQrValidationException(
        'Pairing QR code is missing its token.',
      );
    }

    return PairingQrPayload(
      pairingToken: token ?? '',
      shortCode: shortCode,
      publicDeviceId: json['publicDeviceId']?.toString(),
    );
  }

  static PairingQrPayload _parseLegacyEnvelope(Map<String, dynamic> json) {
    final legacyVersion = json['v'];
    if (legacyVersion != supportedSchemaVersion) {
      throw PairingQrValidationException(
        'Unsupported pairing QR version (${legacyVersion ?? 'unknown'}).',
      );
    }
    final legacyToken = json['t']?.toString();
    if (legacyToken == null || legacyToken.isEmpty) {
      throw const PairingQrValidationException(
        'Pairing QR code is missing its token.',
      );
    }
    return PairingQrPayload(pairingToken: legacyToken);
  }
}

/// `EYE-XXXX-XXXX` manual pairing short-code helpers, mirroring
/// `packages/shared/src/field-preprovisioning.ts` (`FIELD_PAIRING_SHORT_CODE_PATTERN`,
/// `formatFieldPairingShortCode`, `normalizeFieldPairingShortCode`) so client
/// validation and formatting stay consistent with the server.
abstract final class PairingShortCode {
  /// Crockford-like alphabet with no `0/O/1/I/L` ambiguity.
  static const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

  static final RegExp _pattern = RegExp(
    '^EYE-[$alphabet]{4}-[$alphabet]{4}\$',
  );

  /// Uppercases and trims — matches the server's
  /// `normalizeFieldPairingShortCode` exactly (no reformatting).
  static String normalize(String value) => value.trim().toUpperCase();

  /// Reformats loosely-typed or pasted input (e.g. `"eye4f7k92mz"`,
  /// `"4f7k 92mz"`, `"EYE-4f7k-92mz"`) into the canonical `EYE-XXXX-XXXX`
  /// form, so officers don't have to type dashes or worry about case. Safe
  /// to call on every keystroke.
  static String format(String rawCharacters) {
    var cleaned = rawCharacters.toUpperCase().replaceAll(
          RegExp('[^A-Z0-9]'),
          '',
        );
    if (cleaned.startsWith('EYE')) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.length > 8) {
      cleaned = cleaned.substring(0, 8);
    }
    if (cleaned.isEmpty) return 'EYE-';
    if (cleaned.length <= 4) return 'EYE-$cleaned';
    return 'EYE-${cleaned.substring(0, 4)}-${cleaned.substring(4)}';
  }

  static bool isValid(String value) => _pattern.hasMatch(normalize(value));
}
