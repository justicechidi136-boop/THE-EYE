import 'dart:convert';

import 'package:flutter/foundation.dart';

/// Structured activation checkpoints — never log secrets or full activation codes.
abstract final class WatchActivationCheckpoint {
  static const buttonPressed = 'WATCH_ACTIVATION_BUTTON_PRESSED';
  static const inputValidated = 'WATCH_ACTIVATION_INPUT_VALIDATED';
  static const requestBegin = 'WATCH_ACTIVATION_REQUEST_BEGIN';
  static const responseReceived = 'WATCH_ACTIVATION_RESPONSE_RECEIVED';
  static const responseParsed = 'WATCH_ACTIVATION_RESPONSE_PARSED';
  static const tokenPresent = 'WATCH_ACTIVATION_TOKEN_PRESENT';
  static const devicePresent = 'WATCH_ACTIVATION_DEVICE_PRESENT';
  static const persistBegin = 'WATCH_ACTIVATION_PERSIST_BEGIN';
  static const persistSuccess = 'WATCH_ACTIVATION_PERSIST_SUCCESS';
  static const authBootstrapBegin = 'WATCH_AUTH_BOOTSTRAP_BEGIN';
  static const authBootstrapSuccess = 'WATCH_AUTH_BOOTSTRAP_SUCCESS';
  static const homeNavigationBegin = 'WATCH_HOME_NAVIGATION_BEGIN';
  static const homeNavigationSuccess = 'WATCH_HOME_NAVIGATION_SUCCESS';
  static const homeRenderBegin = 'WATCH_HOME_RENDER_BEGIN';
  static const homeRenderSuccess = 'WATCH_HOME_RENDER_SUCCESS';
  static const exception = 'WATCH_ACTIVATION_EXCEPTION';
}

class WatchActivationDiagnostics {
  WatchActivationDiagnostics({void Function(String line)? sink}) : _sink = sink;

  final void Function(String line)? _sink;

  String? _correlationId;

  String get correlationId =>
      _correlationId ??= 'watch-act-${DateTime.now().millisecondsSinceEpoch}';

  void resetCorrelation() {
    _correlationId = null;
  }

  void log(
    String checkpoint, {
    String? correlationId,
    int? activationCodeLength,
    String? activationCodeFingerprint,
    int? httpStatus,
    String? responseSchemaVersion,
    bool? tokenPresent,
    int? tokenLength,
    String? watchDeviceId,
    String? userId,
    String? organizationId,
    String? exceptionType,
    String? exceptionMessage,
    String? stackTrace,
    Map<String, Object?> extra = const {},
  }) {
    final payload = <String, Object?>{
      'checkpoint': checkpoint,
      'correlationId': correlationId ?? this.correlationId,
      if (activationCodeLength != null) 'activationCodeLength': activationCodeLength,
      if (activationCodeFingerprint != null)
        'activationCodeFingerprint': activationCodeFingerprint,
      if (httpStatus != null) 'httpStatus': httpStatus,
      if (responseSchemaVersion != null)
        'responseSchemaVersion': responseSchemaVersion,
      if (tokenPresent != null) 'tokenPresent': tokenPresent,
      if (tokenLength != null) 'tokenLength': tokenLength,
      if (watchDeviceId != null) 'watchDeviceId': watchDeviceId,
      if (userId != null) 'userId': userId,
      if (organizationId != null) 'organizationId': organizationId,
      if (exceptionType != null) 'exceptionType': exceptionType,
      if (exceptionMessage != null) 'exceptionMessage': exceptionMessage,
      if (stackTrace != null && kDebugMode) 'stackTrace': stackTrace,
      ...extra,
    };
    final line = '[THE_EYE_WATCH] ${jsonEncode(payload)}';
    // Always print so logcat captures activation diagnostics on device builds.
    // ignore: avoid_print
    print(line);
    if (_sink != null) {
      _sink(line);
    } else {
      debugPrint(line);
    }
  }

  static String fingerprintCode(String code) {
    final normalized = code.replaceAll(RegExp(r'\s+'), '');
    if (normalized.isEmpty) return 'empty';
    return '${normalized.length}-${normalized.hashCode.abs().toRadixString(16)}';
  }
}
