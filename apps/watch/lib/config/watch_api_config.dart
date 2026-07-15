import 'dart:io';

import 'package:flutter/foundation.dart';

import '../api/watch_api_paths.dart';
import 'watch_flavor.dart';

/// Resolves the THE EYE API base URL for this watch build.
abstract final class WatchApiConfig {
  static const String _dartDefineUrl =
      String.fromEnvironment('THE_EYE_API_BASE_URL');

  static const String _devLanHost = String.fromEnvironment(
    'THE_EYE_DEV_LAN_HOST',
    defaultValue: '10.99.68.107',
  );

  static const String _devEmulatorHost = String.fromEnvironment(
    'THE_EYE_DEV_EMULATOR_HOST',
    defaultValue: '10.0.2.2',
  );

  static const String _stagingDefaultUrl = String.fromEnvironment(
    'THE_EYE_STAGING_API_URL',
    defaultValue: 'https://staging-api.theeye.com.ng/v1',
  );

  static const String _productionDefaultUrl = String.fromEnvironment(
    'THE_EYE_PROD_API_URL',
    defaultValue: 'https://api.theeye.com.ng/v1',
  );

  static const String productionApiHost = 'api.theeye.com.ng';
  static const String stagingApiHost = 'staging-api.theeye.com.ng';

  static String resolveBaseUrl() {
    final env = WatchFlavor.firebaseEnv;

    if (_dartDefineUrl.isNotEmpty) {
      // Ignore dev-machine overrides when building staging/production flavors.
      if (env == WatchFirebaseEnv.development || !isLocalDevUrl(_dartDefineUrl)) {
        return _dartDefineUrl;
      }
    }

    switch (env) {
      case WatchFirebaseEnv.development:
        return _resolveDevelopmentBaseUrl();
      case WatchFirebaseEnv.staging:
        return _stagingDefaultUrl;
      case WatchFirebaseEnv.production:
        return _productionDefaultUrl;
    }
  }

  static String _resolveDevelopmentBaseUrl() {
    if (kIsWeb) {
      return WatchApiPaths.legacyDefaultBaseUrl;
    }

    if (Platform.isAndroid) {
      if (_devLanHost.isNotEmpty &&
          _devLanHost != '127.0.0.1' &&
          _devLanHost != 'localhost') {
        return 'http://$_devLanHost:4000/v1';
      }
      return 'http://$_devEmulatorHost:4000/v1';
    }

    return WatchApiPaths.legacyDefaultBaseUrl;
  }

  static bool isLocalDevUrl(String baseUrl) {
    final normalized = baseUrl.toLowerCase();
    return normalized.contains('localhost') ||
        normalized.contains('127.0.0.1') ||
        normalized.contains('10.0.2.2') ||
        normalized.contains('://test') ||
        RegExp(r'://10\.\d+\.\d+\.\d+').hasMatch(normalized);
  }

  static bool isProductionApiUrl(String baseUrl) {
    final normalized = baseUrl.toLowerCase();
    return normalized.contains(productionApiHost) &&
        !normalized.contains(stagingApiHost);
  }

  static bool isStagingApiUrl(String baseUrl) {
    return baseUrl.toLowerCase().contains(stagingApiHost);
  }
}

void assertWatchApiBaseUrlMatchesFlavor(
  WatchFirebaseEnv env,
  String baseUrl,
) {
  if (WatchApiConfig.isLocalDevUrl(baseUrl)) {
    if (env == WatchFirebaseEnv.development) return;
    throw StateError(
      'Environment guard: ${env.name} build cannot use a local dev API '
      '(`$baseUrl`). Use `--flavor development` for local PC testing, or '
      '`https://${WatchApiConfig.stagingApiHost}/v1` for staging.',
    );
  }

  final isProdApi = WatchApiConfig.isProductionApiUrl(baseUrl);
  final isStagingApi = WatchApiConfig.isStagingApiUrl(baseUrl);

  if (env == WatchFirebaseEnv.staging && isProdApi) {
    throw StateError(
      'Environment guard: staging build cannot register against production API '
      '(`$baseUrl`). Use `https://${WatchApiConfig.stagingApiHost}/v1`.',
    );
  }

  if (env == WatchFirebaseEnv.production && isStagingApi) {
    throw StateError(
      'Environment guard: production build cannot use staging API '
      '(`$baseUrl`). Use `https://${WatchApiConfig.productionApiHost}/v1`.',
    );
  }
}
