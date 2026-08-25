import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:uuid/uuid.dart';

import '../api/field_api_client.dart';
import '../api/field_api_paths.dart';
import '../config/app_flavor.dart';
import '../security/device_keystore_service.dart';
import '../security/secure_session_store.dart';

class FieldChallenge {
  const FieldChallenge({
    required this.challengeId,
    required this.challenge,
    required this.challengeSignature,
  });

  final String challengeId;
  final String challenge;
  final String challengeSignature;
}

class FieldLoginResult {
  const FieldLoginResult({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
    required this.sessionId,
    required this.publicDeviceId,
    this.officerId,
    this.officerName,
    this.preferredLocale,
    this.effectivePreferredLocale,
    this.registrationStatus,
  });

  factory FieldLoginResult.fromJson(Map<String, dynamic> json) {
    final data = Map<String, dynamic>.from(json['data'] as Map? ?? json);
    final officer = Map<String, dynamic>.from(
      data['officer'] as Map? ?? const {},
    );
    final device = Map<String, dynamic>.from(
      data['device'] as Map? ?? const {},
    );
    return FieldLoginResult(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
      expiresIn: data['expiresIn'] as int? ?? 0,
      sessionId: data['sessionId'] as String,
      publicDeviceId: device['publicDeviceId'] as String? ?? '',
      officerId: officer['id'] as String?,
      officerName: officer['displayName'] as String?,
      preferredLocale: officer['preferredLocale'] as String?,
      effectivePreferredLocale: officer['effectivePreferredLocale'] as String?,
      registrationStatus: device['registrationStatus'] as String?,
    );
  }

  factory FieldLoginResult.fromRefreshJson(
    Map<String, dynamic> json, {
    required String refreshToken,
    required String publicDeviceId,
    String? officerId,
    String? officerName,
    String? preferredLocale,
  }) {
    final data = Map<String, dynamic>.from(json['data'] as Map? ?? json);
    return FieldLoginResult(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String? ?? refreshToken,
      expiresIn: (data['expiresIn'] as num?)?.toInt() ?? 0,
      sessionId: data['sessionId'] as String,
      publicDeviceId: publicDeviceId,
      officerId: officerId,
      officerName: officerName,
      preferredLocale: preferredLocale,
      effectivePreferredLocale: preferredLocale,
    );
  }

  final String accessToken;
  final String refreshToken;
  final int expiresIn;
  final String sessionId;
  final String publicDeviceId;
  final String? officerId;
  final String? officerName;
  final String? preferredLocale;
  final String? effectivePreferredLocale;
  final String? registrationStatus;
}

class FieldAuthService {
  FieldAuthService({
    required FieldApiClient api,
    required SecureSessionStore session,
    required DeviceKeystoreService keystore,
    Future<void> Function(String? locale)? onLocaleResolved,
    Future<void> Function()? onLogoutLocaleCleared,
  }) : _api = api,
       _session = session,
       _keystore = keystore,
       _onLocaleResolved = onLocaleResolved,
       _onLogoutLocaleCleared = onLogoutLocaleCleared;

  final FieldApiClient _api;
  final SecureSessionStore _session;
  final DeviceKeystoreService _keystore;
  final Future<void> Function(String? locale)? _onLocaleResolved;
  final Future<void> Function()? _onLogoutLocaleCleared;

  Future<FieldChallenge> createSignedChallenge() async {
    final response = await _api.post(FieldApiPaths.deviceChallenge);
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

  Future<FieldLoginResult> login({
    required String email,
    required String password,
    required String publicDeviceId,
  }) async {
    final signed = await createSignedChallenge();
    final response = await _api.post(
      FieldApiPaths.authLogin,
      body: {
        'email': email.trim(),
        'password': password,
        'publicDeviceId': publicDeviceId,
        'challengeId': signed.challengeId,
        'challenge': signed.challenge,
        'challengeSignature': signed.challengeSignature,
        'packageName': AppFlavor.androidPackageId,
        'appEnvironment': AppFlavor.envName,
      },
    );

    final result = FieldLoginResult.fromJson(response);
    await _session.saveSession(
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      sessionId: result.sessionId,
      publicDeviceId: result.publicDeviceId,
      officerId: result.officerId,
      officerName: result.officerName,
      preferredLocale:
          result.effectivePreferredLocale ?? result.preferredLocale,
    );
    _api.accessToken = result.accessToken;
    await _onLocaleResolved?.call(
      result.effectivePreferredLocale ?? result.preferredLocale,
    );
    return result;
  }

  Future<FieldLoginResult> refreshSession() async {
    final refreshToken = await _session.readRefreshToken();
    final publicDeviceId = await _session.readPublicDeviceId();
    if (refreshToken == null ||
        refreshToken.isEmpty ||
        publicDeviceId == null ||
        publicDeviceId.isEmpty) {
      throw StateError('No refresh session available');
    }

    final response = await _api.post(
      FieldApiPaths.authRefresh,
      body: {'refreshToken': refreshToken, 'publicDeviceId': publicDeviceId},
    );
    final result = FieldLoginResult.fromRefreshJson(
      response,
      refreshToken: refreshToken,
      publicDeviceId: publicDeviceId,
      officerId: await _session.readOfficerId(),
      officerName: await _session.readOfficerName(),
      preferredLocale: await _session.readPreferredLocale(),
    );
    await _session.saveSession(
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      sessionId: result.sessionId,
      publicDeviceId: result.publicDeviceId,
      officerId: result.officerId,
      officerName: result.officerName,
      preferredLocale:
          result.effectivePreferredLocale ?? result.preferredLocale,
    );
    _api.accessToken = result.accessToken;
    await _onLocaleResolved?.call(
      result.effectivePreferredLocale ?? result.preferredLocale,
    );
    return result;
  }

  Future<void> logout() async {
    final token = await _session.readAccessToken();
    if (token != null && token.isNotEmpty) {
      _api.accessToken = token;
      try {
        await _api.post(FieldApiPaths.authLogout);
      } on FieldApiException {
        // Local wipe still proceeds when remote logout fails.
      }
    }
    await _session.clearSession();
    _api.accessToken = null;
    await _onLogoutLocaleCleared?.call();
  }

  Future<void> lockSession() async {
    final token = await _session.readAccessToken();
    if (token != null && token.isNotEmpty) {
      _api.accessToken = token;
      await _api.post(FieldApiPaths.authLock);
    }
    await _session.setLocked(true);
  }

  Future<void> unlockSession() async {
    final token = await _session.readAccessToken();
    if (token != null && token.isNotEmpty) {
      _api.accessToken = token;
      await _api.post(FieldApiPaths.authUnlock);
    }
    await _session.setLocked(false);
  }

  Future<Map<String, dynamic>> getSession() async {
    final token = await _session.readAccessToken();
    if (token == null || token.isEmpty) {
      throw StateError('No active session');
    }
    _api.accessToken = token;
    return _api.get(FieldApiPaths.authSession);
  }

  Future<void> restoreApiToken() async {
    _api.accessToken = await _session.readAccessToken();
  }

  static Future<String> ensureInstallationId(SecureSessionStore session) async {
    final existing = await session.readInstallationId();
    if (existing != null && existing.isNotEmpty) return existing;
    const uuid = Uuid();
    final installationId = uuid.v4();
    await session.saveInstallationId(installationId);
    return installationId;
  }

  static Future<String> hashInstallationId(String installationId) async {
    final hash = await Sha256().hash(utf8.encode(installationId));
    return base64Encode(hash.bytes);
  }
}
