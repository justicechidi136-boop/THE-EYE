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

  static String resolveBaseUrl() {
    if (_dartDefineUrl.isNotEmpty) return _dartDefineUrl;

    switch (AppFlavorConfig.current) {
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
}
