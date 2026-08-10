import '../api/field_api_client.dart';
import '../api/field_api_paths.dart';
import '../auth/field_auth_service.dart';
import '../config/app_flavor.dart';
import '../security/device_keystore_service.dart';

/// Non-sensitive confirmation info returned by `claim()`, shown to the
/// officer so they can confirm "this is my tablet" before the cryptographic
/// handshake proceeds. Never treated as authoritative — activation state and
/// permissions always come from `complete()`.
class FieldPairingClaim {
  const FieldPairingClaim({
    required this.publicDeviceId,
    required this.deviceName,
    required this.expiresAt,
    this.operationalRole,
  });

  factory FieldPairingClaim.fromJson(Map<String, dynamic> json) {
    final data = Map<String, dynamic>.from(json['data'] as Map? ?? json);
    return FieldPairingClaim(
      publicDeviceId: data['publicDeviceId'] as String? ?? '',
      deviceName: data['deviceName'] as String? ?? 'Field tablet',
      operationalRole: data['operationalRole'] as String?,
      expiresAt: data['expiresAt'] as String? ?? '',
    );
  }

  final String publicDeviceId;
  final String deviceName;
  final String? operationalRole;
  final String expiresAt;
}

/// Result of `complete()` — the only place activation/registration state is
/// derived from for the pairing flow.
class FieldPairingCompletion {
  const FieldPairingCompletion({
    required this.publicDeviceId,
    required this.registrationStatus,
    this.preProvisionStatus,
    this.requiresFinalApproval = false,
  });

  factory FieldPairingCompletion.fromJson(Map<String, dynamic> json) {
    final data = Map<String, dynamic>.from(json['data'] as Map? ?? json);
    return FieldPairingCompletion(
      publicDeviceId: data['publicDeviceId'] as String? ?? '',
      registrationStatus: data['registrationStatus'] as String? ?? 'Unknown',
      preProvisionStatus: data['preProvisionStatus'] as String?,
      requiresFinalApproval: data['requiresFinalApproval'] as bool? ?? false,
    );
  }

  final String publicDeviceId;
  final String registrationStatus;
  final String? preProvisionStatus;
  final bool requiresFinalApproval;

  bool get isActive => registrationStatus == 'Active' && !requiresFinalApproval;
  bool get isPendingApproval => !isActive;
}

class FieldPairingStatus {
  const FieldPairingStatus({
    required this.status,
    required this.expiresAt,
    required this.attemptsRemaining,
  });

  factory FieldPairingStatus.fromJson(Map<String, dynamic> json) {
    final data = Map<String, dynamic>.from(json['data'] as Map? ?? json);
    return FieldPairingStatus(
      status: data['status'] as String? ?? 'Unknown',
      expiresAt: data['expiresAt'] as String? ?? '',
      attemptsRemaining: data['attemptsRemaining'] as int? ?? 0,
    );
  }

  final String status;
  final String expiresAt;
  final int attemptsRemaining;
}

/// Identifies a pairing token/short-code pair supplied by a QR scan or
/// manual entry. Exactly one of [pairingToken] / [shortCode] is normally set.
class FieldPairingLookup {
  const FieldPairingLookup({this.pairingToken, this.shortCode});

  final String? pairingToken;
  final String? shortCode;

  Map<String, dynamic> toBody() => {
        if (pairingToken != null && pairingToken!.isNotEmpty)
          'pairingToken': pairingToken,
        if (shortCode != null && shortCode!.isNotEmpty) 'shortCode': shortCode,
      };

  Map<String, String> toQuery() => {
        if (pairingToken != null && pairingToken!.isNotEmpty)
          'pairingToken': pairingToken!,
        if (shortCode != null && shortCode!.isNotEmpty) 'shortCode': shortCode!,
      };
}

/// Field-side pre-provisioned device pairing (QR / short code).
///
/// Mirrors the server contract in
/// `apps/api/src/modules/field-operations/field-device-pairing.service.ts`
/// (see also `docs/FIELD_DEVICE_PAIRING.md`). Every endpoint here is
/// unauthenticated by design — the device has no session yet — so trust
/// comes entirely from possessing a single-use pairing token/short code
/// plus, at completion time, a valid device-key signature over a fresh
/// server challenge.
///
/// This service **never** derives permissions, roles, or activation state
/// from anything embedded in a QR code. `claim()`'s `deviceName` /
/// `operationalRole` are shown only as a confirmation hint; the actual grant
/// always comes from the server's `complete()` response.
class FieldPairingService {
  FieldPairingService({
    required FieldApiClient api,
    required DeviceKeystoreService keystore,
  })  : _api = api,
        _keystore = keystore;

  final FieldApiClient _api;
  final DeviceKeystoreService _keystore;

  Future<void> ensureKeyPair() => _keystore.ensureKeyPair();

  Future<String?> readPublicKeyBase64() => _keystore.readPublicKeyBase64();

  Future<FieldPairingClaim> claim(FieldPairingLookup lookup) async {
    final response = await _api.post(
      FieldApiPaths.pairingClaim,
      body: lookup.toBody(),
    );
    return FieldPairingClaim.fromJson(response);
  }

  Future<FieldChallenge> requestChallenge(FieldPairingLookup lookup) async {
    final response = await _api.post(
      FieldApiPaths.pairingChallenge,
      body: lookup.toBody(),
    );
    final data = Map<String, dynamic>.from(response['data'] as Map);
    final challengeId = data['challengeId'] as String;
    final challenge = data['challenge'] as String;
    final signature = await _keystore.signChallenge(challenge);
    return FieldChallenge(
      challengeId: challengeId,
      challenge: challenge,
      challengeSignature: signature,
    );
  }

  Future<FieldPairingCompletion> complete(
    FieldPairingLookup lookup, {
    required FieldChallenge signedChallenge,
    required String publicKey,
    required String installationIdHash,
    String? deviceName,
    String? manufacturer,
    String? model,
    String? androidVersion,
    String? appVersion,
    String? buildNumber,
  }) async {
    final response = await _api.post(
      FieldApiPaths.pairingComplete,
      body: {
        ...lookup.toBody(),
        'challengeId': signedChallenge.challengeId,
        'challenge': signedChallenge.challenge,
        'challengeSignature': signedChallenge.challengeSignature,
        'publicKey': publicKey,
        'installationIdHash': installationIdHash,
        if (deviceName != null && deviceName.trim().isNotEmpty)
          'deviceName': deviceName.trim(),
        if (manufacturer != null) 'manufacturer': manufacturer,
        if (model != null) 'model': model,
        if (androidVersion != null) 'androidVersion': androidVersion,
        if (appVersion != null) 'appVersion': appVersion,
        if (buildNumber != null) 'buildNumber': buildNumber,
        'packageName': AppFlavor.androidPackageId,
        'appEnvironment': AppFlavor.envName,
      },
    );
    return FieldPairingCompletion.fromJson(response);
  }

  Future<FieldPairingStatus> status(FieldPairingLookup lookup) async {
    final response = await _api.get(
      FieldApiPaths.pairingStatus,
      query: lookup.toQuery(),
    );
    return FieldPairingStatus.fromJson(response);
  }
}
