import 'dart:async';

import 'package:http/http.dart' as http;

import '../api/watch_api_client.dart';
import '../api/watch_api_paths.dart';
import '../config/watch_api_config.dart';
import '../config/watch_flavor.dart';
import '../models/standalone_activation_result.dart';
import '../storage/secure_credential_store.dart';
import 'connectivity_service.dart';
import 'watch_activation_diagnostics.dart';
import 'watch_activation_exception.dart';

typedef WatchAuthBootstrap = Future<void> Function();

typedef WatchNetworkReadinessCheck = Future<void> Function(WatchApiClient api);

class StandaloneAuthService {
  StandaloneAuthService({
    required WatchApiClient api,
    required SecureCredentialStore credentials,
    ConnectivityService? connectivity,
    WatchActivationDiagnostics? diagnostics,
    WatchAuthBootstrap? authBootstrap,
    WatchNetworkReadinessCheck? assertNetworkReady,
  })  : _api = api,
        _credentials = credentials,
        _connectivity = connectivity,
        _diagnostics = diagnostics ?? WatchActivationDiagnostics(),
        _authBootstrap = authBootstrap {
    _assertNetworkReady = assertNetworkReady ??
        ((api) => defaultNetworkReadinessCheck(api, _diagnostics));
  }

  final WatchApiClient _api;
  final SecureCredentialStore _credentials;
  final ConnectivityService? _connectivity;
  final WatchActivationDiagnostics _diagnostics;
  final WatchAuthBootstrap? _authBootstrap;
  late final WatchNetworkReadinessCheck _assertNetworkReady;

  WatchActivationDiagnostics get diagnostics => _diagnostics;

  /// Admin-dashboard activation: device ID + 6-digit pairing code.
  Future<StandaloneActivationResult> activateWithAdminCode({
    required String deviceId,
    required String pairingCode,
  }) async {
    _diagnostics.resetCorrelation();
    final normalizedDeviceId = deviceId.trim();
    final normalizedCode = pairingCode.replaceAll(RegExp(r'\s+'), '');

    _diagnostics.log(WatchActivationCheckpoint.buttonPressed);

    if (normalizedDeviceId.length < 2) {
      throw WatchActivationException.validation(
        'Enter the device ID shown in the admin dashboard.',
      );
    }
    if (!RegExp(r'^\d{6}$').hasMatch(normalizedCode)) {
      throw WatchActivationException.validation(
        'Activation code must be 6 digits.',
      );
    }

    _diagnostics.log(
      WatchActivationCheckpoint.inputValidated,
      activationCodeLength: normalizedCode.length,
      activationCodeFingerprint:
          WatchActivationDiagnostics.fingerprintCode(normalizedCode),
      watchDeviceId: normalizedDeviceId,
      extra: {
        'apiHost': _api.apiHost,
        'firebaseEnv': WatchFlavor.envName,
      },
    );

    Map<String, dynamic> response;
    try {
      _diagnostics.log(
        WatchActivationCheckpoint.requestBegin,
        watchDeviceId: normalizedDeviceId,
      );

      final packageInfo = await _safePackageInfo();
      response = await _api.post(
        WatchApiPaths.activateWithCode,
        body: {
          'deviceId': normalizedDeviceId,
          'pairingCode': normalizedCode,
          'firebaseEnv': WatchFlavor.envName,
          'correlationId': _diagnostics.correlationId,
          if (packageInfo != null) 'appVersion': packageInfo,
        },
      );
    } on WatchApiException catch (error) {
      _diagnostics.log(
        WatchActivationCheckpoint.exception,
        httpStatus: error.statusCode,
        exceptionType: error.runtimeType.toString(),
        exceptionMessage: error.message,
      );
      throw WatchActivationException.fromHttpStatus(
        error.statusCode ?? 0,
        error.message,
      );
    } on TimeoutException catch (error) {
      _diagnostics.log(
        WatchActivationCheckpoint.exception,
        exceptionType: error.runtimeType.toString(),
        exceptionMessage: error.toString(),
      );
      throw WatchActivationException.networkTimeout(error);
    } on http.ClientException catch (error) {
      _diagnostics.log(
        WatchActivationCheckpoint.exception,
        exceptionType: error.runtimeType.toString(),
        exceptionMessage: error.message,
      );
      throw WatchActivationException.networkClient(error);
    } catch (error, stack) {
      _diagnostics.log(
        WatchActivationCheckpoint.exception,
        exceptionType: error.runtimeType.toString(),
        exceptionMessage: error.toString(),
        stackTrace: stack.toString(),
      );
      throw WatchActivationException.networkUnexpected(error);
    }

    _diagnostics.log(
      WatchActivationCheckpoint.responseReceived,
      watchDeviceId: normalizedDeviceId,
    );

    late final StandaloneActivationResult parsed;
    try {
      parsed = StandaloneActivationResult.fromJson(response);
    } catch (error, stack) {
      _diagnostics.log(
        WatchActivationCheckpoint.exception,
        exceptionType: error.runtimeType.toString(),
        exceptionMessage: error.toString(),
        stackTrace: stack.toString(),
      );
      throw WatchActivationException.responseParse(error);
    }

    _diagnostics.log(
      WatchActivationCheckpoint.responseParsed,
      responseSchemaVersion: StandaloneActivationResult.schemaVersion,
      tokenPresent: parsed.accessToken.isNotEmpty,
      tokenLength: parsed.accessToken.length,
      watchDeviceId: parsed.deviceId,
      userId: parsed.ownerType == 'PERSON' ? parsed.ownerId : null,
      organizationId:
          parsed.ownerType == 'ORGANIZATION' ? parsed.ownerId : null,
      correlationId: parsed.correlationId.isNotEmpty
          ? parsed.correlationId
          : _diagnostics.correlationId,
    );

    _diagnostics.log(
      WatchActivationCheckpoint.tokenPresent,
      tokenPresent: true,
      tokenLength: parsed.accessToken.length,
    );
    _diagnostics.log(
      WatchActivationCheckpoint.devicePresent,
      watchDeviceId: parsed.deviceId,
    );

    await _persistActivation(parsed);
    await _runAuthBootstrap();

    return parsed;
  }

  Future<void> _persistActivation(StandaloneActivationResult parsed) async {
    _diagnostics.log(WatchActivationCheckpoint.persistBegin);
    try {
      await _credentials.saveActivationSession(
        deviceId: parsed.deviceId,
        deviceSecret: parsed.deviceSecret,
        accessToken: parsed.accessToken,
        watchInternalId: parsed.watchId,
        ownerId: parsed.ownerId,
        ownerType: parsed.ownerType,
      );

      final verified = await _credentials.verifyActivationSession(
        expectedDeviceId: parsed.deviceId,
      );
      if (!verified.tokenPresent || !verified.deviceSecretPresent) {
        throw StateError('Credential read-back verification failed');
      }

      _api.accessToken = parsed.accessToken;
      _api.deviceSecret = parsed.deviceSecret;
      _connectivity?.configureStandaloneOnline();

      _diagnostics.log(
        WatchActivationCheckpoint.persistSuccess,
        tokenPresent: verified.tokenPresent,
        watchDeviceId: verified.deviceId,
      );
    } catch (error, stack) {
      _diagnostics.log(
        WatchActivationCheckpoint.exception,
        exceptionType: error.runtimeType.toString(),
        exceptionMessage: error.toString(),
        stackTrace: stack.toString(),
      );
      throw WatchActivationException.secureStorage(error);
    }
  }

  Future<void> _runAuthBootstrap() async {
    _diagnostics.log(WatchActivationCheckpoint.authBootstrapBegin);
    try {
      if (_authBootstrap != null) {
        await _authBootstrap!().timeout(const Duration(seconds: 8));
      }
      _diagnostics.log(WatchActivationCheckpoint.authBootstrapSuccess);
    } catch (error, stack) {
      _diagnostics.log(
        WatchActivationCheckpoint.exception,
        exceptionType: error.runtimeType.toString(),
        exceptionMessage: error.toString(),
        stackTrace: stack.toString(),
      );
      // Non-fatal — credentials are saved; home screen can load degraded.
    }
  }

  /// Subsequent login using stored device secret (not admin pairing code).
  Future<bool> loginWithStoredSecret() async {
    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    if (deviceId == null ||
        deviceId.isEmpty ||
        deviceSecret == null ||
        deviceSecret.isEmpty) {
      throw WatchActivationException.validation(
        'Device credentials are missing. Enter your activation code again.',
      );
    }

    final response = await _api.post(
      WatchApiPaths.standaloneLogin,
      body: {
        'deviceId': deviceId,
        'deviceSecret': deviceSecret,
      },
    );

    final token = response['accessToken'] as String?;
    if (token == null || token.isEmpty) return false;

    await _credentials.saveAccessToken(token);
    _api.accessToken = token;
    _api.deviceSecret = deviceSecret;
    return true;
  }

  Future<void> hydrateApiAuth() async {
    _api.accessToken = await _credentials.readAccessToken();
    _api.deviceSecret = await _credentials.readDeviceSecret();
  }

  Future<String?> _safePackageInfo() async {
    return null;
  }
}

Future<void> defaultNetworkReadinessCheck(
  WatchApiClient api, [
  WatchActivationDiagnostics? diagnostics,
]) async {
  if (WatchApiConfig.isLocalDevUrl(api.baseUrl) &&
      WatchFlavor.firebaseEnv != WatchFirebaseEnv.development) {
    throw WatchActivationException.devApiMisconfigured(api.apiHost);
  }

  try {
    await api.pingHealthReady();
  } on WatchApiException catch (error) {
    diagnostics?.log(
      WatchActivationCheckpoint.exception,
      httpStatus: error.statusCode,
      exceptionType: error.runtimeType.toString(),
      exceptionMessage: error.message,
      extra: {'apiHost': api.apiHost, 'phase': 'health_check'},
    );
    throw WatchActivationException.serverUnreachable(api.apiHost, error);
  } on TimeoutException catch (error) {
    diagnostics?.log(
      WatchActivationCheckpoint.exception,
      exceptionType: error.runtimeType.toString(),
      exceptionMessage: error.toString(),
      extra: {'apiHost': api.apiHost, 'phase': 'health_check'},
    );
    throw WatchActivationException.serverUnreachable(api.apiHost, error);
  } catch (error, stack) {
    diagnostics?.log(
      WatchActivationCheckpoint.exception,
      exceptionType: error.runtimeType.toString(),
      exceptionMessage: error.toString(),
      stackTrace: stack.toString(),
      extra: {'apiHost': api.apiHost, 'phase': 'health_check'},
    );
    throw WatchActivationException.serverUnreachable(api.apiHost, error);
  }
}
