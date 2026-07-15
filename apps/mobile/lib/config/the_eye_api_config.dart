import "dart:io";

import "package:flutter/foundation.dart";

import "../contracts/the_eye_api_paths.dart";
import "app_flavor.dart";

/// Resolves the THE EYE API base URL for this build.
abstract final class TheEyeApiConfig {
  static const String _dartDefineUrl =
      String.fromEnvironment("THE_EYE_API_URL");

  /// Override when your PC LAN IP changes:
  /// `--dart-define=THE_EYE_DEV_LAN_HOST=10.0.0.5`
  static const String _devLanHost = String.fromEnvironment(
    "THE_EYE_DEV_LAN_HOST",
    defaultValue: "10.99.68.107",
  );

  /// Android emulator loopback to host machine (override via dart-define).
  static const String _devEmulatorHost = String.fromEnvironment(
    "THE_EYE_DEV_EMULATOR_HOST",
    defaultValue: "10.0.2.2",
  );

  static const String _stagingDefaultUrl = String.fromEnvironment(
    "THE_EYE_STAGING_API_URL",
    defaultValue: "https://staging-api.theeye.com.ng/v1",
  );

  static const String _productionDefaultUrl = String.fromEnvironment(
    "THE_EYE_PROD_API_URL",
    defaultValue: "https://api.theeye.com.ng/v1",
  );

  static const String productionApiHost = "api.theeye.com.ng";
  static const String stagingApiHost = "staging-api.theeye.com.ng";

  static String resolveBaseUrl() {
    final flavor = AppFlavorConfig.current;

    if (_dartDefineUrl.isNotEmpty) {
      // Ignore dev-machine overrides when building staging/production flavors.
      if (flavor == AppFlavor.development || !isLocalDevUrl(_dartDefineUrl)) {
        return _dartDefineUrl;
      }
    }

    switch (flavor) {
      case AppFlavor.development:
        return _resolveDevelopmentBaseUrl();
      case AppFlavor.staging:
        return _stagingDefaultUrl;
      case AppFlavor.production:
        return _productionDefaultUrl;
    }
  }

  static String _resolveDevelopmentBaseUrl() {
    if (kIsWeb) {
      return TheEyeApiPaths.defaultBaseUrl;
    }

    if (Platform.isAndroid) {
      if (_devLanHost.isNotEmpty &&
          _devLanHost != "127.0.0.1" &&
          _devLanHost != "localhost") {
        return "http://$_devLanHost:4000/v1";
      }
      return "http://$_devEmulatorHost:4000/v1";
    }

    return TheEyeApiPaths.defaultBaseUrl;
  }

  static bool isLocalDevUrl(String baseUrl) {
    final normalized = baseUrl.toLowerCase();
    return normalized.contains("localhost") ||
        normalized.contains("127.0.0.1") ||
        normalized.contains("10.0.2.2") ||
        normalized.contains("://test") ||
        RegExp(r"://10\.\d+\.\d+\.\d+").hasMatch(normalized);
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

/// Ensures a build flavor cannot call the wrong API environment.
void assertMobileApiBaseUrlMatchesFlavor(
  AppFlavor flavor,
  String baseUrl,
) {
  if (TheEyeApiConfig.isLocalDevUrl(baseUrl)) {
    if (flavor == AppFlavor.development) return;
    throw StateError(
      "Environment guard: ${flavor.name} build cannot use a local dev API "
      "(`$baseUrl`). Use `--flavor development` for local PC testing, or "
      "`https://${TheEyeApiConfig.stagingApiHost}/v1` for staging.",
    );
  }

  final isProdApi = TheEyeApiConfig.isProductionApiUrl(baseUrl);
  final isStagingApi = TheEyeApiConfig.isStagingApiUrl(baseUrl);

  if (flavor == AppFlavor.staging && isProdApi) {
    throw StateError(
      "Environment guard: staging build cannot call production API "
      "(`$baseUrl`). Use `https://${TheEyeApiConfig.stagingApiHost}/v1`.",
    );
  }

  if (flavor == AppFlavor.production && isStagingApi) {
    throw StateError(
      "Environment guard: production build cannot use staging API "
      "(`$baseUrl`). Use `https://${TheEyeApiConfig.productionApiHost}/v1`.",
    );
  }
}
