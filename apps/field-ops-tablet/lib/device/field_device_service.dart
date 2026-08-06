import '../api/field_api_client.dart';
import '../api/field_api_paths.dart';
import '../auth/field_auth_service.dart';
import '../config/app_flavor.dart';
import '../security/device_keystore_service.dart';
import '../security/secure_session_store.dart';

class FieldDeviceRecord {
  const FieldDeviceRecord({
    required this.id,
    required this.publicDeviceId,
    required this.deviceName,
    required this.registrationStatus,
    this.manufacturer,
    this.model,
    this.requiresRePair = false,
    this.isLost = false,
    this.isRevoked = false,
    this.lastSeenAt,
  });

  factory FieldDeviceRecord.fromJson(Map<String, dynamic> json) {
    final data = Map<String, dynamic>.from(json['data'] as Map? ?? json);
    return FieldDeviceRecord(
      id: data['id'] as String? ?? '',
      publicDeviceId: data['publicDeviceId'] as String,
      deviceName: data['deviceName'] as String? ?? 'Field tablet',
      registrationStatus: data['registrationStatus'] as String? ?? 'Unknown',
      manufacturer: data['manufacturer'] as String?,
      model: data['model'] as String?,
      requiresRePair: data['requiresRePair'] as bool? ?? false,
      isLost: data['isLost'] as bool? ?? false,
      isRevoked: data['isRevoked'] as bool? ?? false,
      lastSeenAt: data['lastSeenAt'] as String?,
    );
  }

  bool get isPendingApproval => registrationStatus == 'PendingApproval';
  bool get isActive => registrationStatus == 'Active';
  bool get isBlocked =>
      isRevoked || isLost || registrationStatus == 'Suspended';

  final String id;
  final String publicDeviceId;
  final String deviceName;
  final String registrationStatus;
  final String? manufacturer;
  final String? model;
  final bool requiresRePair;
  final bool isLost;
  final bool isRevoked;
  final String? lastSeenAt;
}

class FieldDeviceService {
  FieldDeviceService({
    required FieldApiClient api,
    required SecureSessionStore session,
    required DeviceKeystoreService keystore,
    required FieldAuthService auth,
  })  : _api = api,
        _session = session,
        _keystore = keystore,
        _auth = auth;

  final FieldApiClient _api;
  final SecureSessionStore _session;
  final DeviceKeystoreService _keystore;
  final FieldAuthService _auth;

  Future<FieldChallenge> createChallenge() => _auth.createSignedChallenge();

  Future<FieldDeviceRecord> registerDevice({
    required String deviceName,
    required FieldChallenge signedChallenge,
    String? manufacturer,
    String? model,
    String? androidVersion,
    String? appVersion,
  }) async {
    await _keystore.ensureKeyPair();
    final installationId =
        await FieldAuthService.ensureInstallationId(_session);
    final installationIdHash =
        await FieldAuthService.hashInstallationId(installationId);
    final publicKey = await _keystore.readPublicKeyBase64();
    if (publicKey == null || publicKey.isEmpty) {
      throw StateError('Device public key unavailable');
    }

    final response = await _api.post(
      FieldApiPaths.deviceRegister,
      body: {
        'challengeId': signedChallenge.challengeId,
        'challenge': signedChallenge.challenge,
        'challengeSignature': signedChallenge.challengeSignature,
        'publicKey': publicKey,
        'installationIdHash': installationIdHash,
        'deviceName': deviceName.trim(),
        if (manufacturer != null) 'manufacturer': manufacturer,
        if (model != null) 'model': model,
        if (androidVersion != null) 'androidVersion': androidVersion,
        if (appVersion != null) 'appVersion': appVersion,
        'packageName': AppFlavor.androidPackageId,
        'appEnvironment': AppFlavor.envName,
      },
    );

    final device = FieldDeviceRecord.fromJson(response);
    await _session.savePublicDeviceId(device.publicDeviceId);
    return device;
  }

  Future<FieldDeviceRecord> registrationStatus({
    String? publicDeviceId,
    String? installationIdHash,
  }) async {
    final resolvedPublicId =
        publicDeviceId ?? await _session.readPublicDeviceId();
    final resolvedInstallationId = installationIdHash ??
        await FieldAuthService.hashInstallationId(
          await FieldAuthService.ensureInstallationId(_session),
        );

    final response = await _api.get(
      FieldApiPaths.deviceRegistrationStatus,
      query: {
        if (resolvedPublicId != null && resolvedPublicId.isNotEmpty)
          'publicDeviceId': resolvedPublicId
        else
          'installationIdHash': resolvedInstallationId,
      },
    );
    final device = FieldDeviceRecord.fromJson(response);
    await _session.savePublicDeviceId(device.publicDeviceId);
    return device;
  }

  Future<FieldDeviceRecord> completePairing({
    required String publicDeviceId,
    required FieldChallenge signedChallenge,
  }) async {
    final response = await _api.post(
      FieldApiPaths.deviceCompletePairing,
      body: {
        'publicDeviceId': publicDeviceId,
        'challengeId': signedChallenge.challengeId,
        'challenge': signedChallenge.challenge,
        'challengeSignature': signedChallenge.challengeSignature,
      },
    );
    return FieldDeviceRecord.fromJson(response);
  }

  Future<Map<String, dynamic>> heartbeat({
    required String publicDeviceId,
    String? appVersion,
    String? androidVersion,
    int? batteryLevel,
    String? networkType,
  }) async {
    return _api.post(
      FieldApiPaths.deviceHeartbeat(publicDeviceId),
      body: {
        if (appVersion != null) 'appVersion': appVersion,
        if (androidVersion != null) 'androidVersion': androidVersion,
        if (batteryLevel != null) 'batteryLevel': batteryLevel,
        if (networkType != null) 'networkType': networkType,
        'activeMode': 'idle',
      },
    );
  }
}
