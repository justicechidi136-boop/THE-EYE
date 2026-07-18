/// Build-time flavor selection for THE EYE mobile.
///
/// Android/iOS: pass `--flavor development|staging|production` (sets
/// [String.fromEnvironment] `FLUTTER_APP_FLAVOR`).
///
/// Override in tests or CI: `--dart-define=THE_EYE_FLAVOR=staging`
enum AppFlavor {
  development,
  staging,
  production,
}

abstract final class AppFlavorConfig {
  static const _dartDefineFlavor =
      String.fromEnvironment("THE_EYE_FLAVOR");
  static const _flutterFlavor =
      String.fromEnvironment("FLUTTER_APP_FLAVOR");

  static AppFlavor get current {
    final raw = _dartDefineFlavor.isNotEmpty
        ? _dartDefineFlavor
        : _flutterFlavor;
    switch (raw.toLowerCase()) {
      case "development":
      case "dev":
        return AppFlavor.development;
      case "staging":
      case "stg":
        return AppFlavor.staging;
      case "production":
      case "prod":
        return AppFlavor.production;
      case "":
        throw StateError(
          "App flavor is not configured. Rebuild with "
          "--flavor development|staging|production and "
          "--dart-define=THE_EYE_FLAVOR=<same>.",
        );
      default:
        throw StateError(
          "Unknown app flavor '$raw'. Use development, staging, or production.",
        );
    }
  }

  static String get androidApplicationId {
    switch (current) {
      case AppFlavor.development:
        return "com.theeye.app.dev";
      case AppFlavor.staging:
        return "com.theeye.app.staging";
      case AppFlavor.production:
        return "com.theeye.app";
    }
  }

  static String get iosBundleId {
    switch (current) {
      case AppFlavor.development:
        return "com.theeye.app.dev";
      case AppFlavor.staging:
        return "com.theeye.app.staging";
      case AppFlavor.production:
        return "com.theeye.app";
    }
  }

  static String get firebaseProjectId {
    switch (current) {
      case AppFlavor.development:
        return "the-eye-29cff";
      case AppFlavor.staging:
        return "the-eye-2stg";
      case AppFlavor.production:
        return "the-eye-2pd-d0217";
    }
  }

  /// Value sent to the API when pairing a smartwatch device.
  static String get firebaseEnvName {
    switch (current) {
      case AppFlavor.development:
        return "development";
      case AppFlavor.staging:
        return "staging";
      case AppFlavor.production:
        return "production";
    }
  }

  static String get displayName {
    switch (current) {
      case AppFlavor.development:
        return "THE EYE Dev";
      case AppFlavor.staging:
        return "THE EYE Staging";
      case AppFlavor.production:
        return "THE EYE";
    }
  }

  static bool get isDevelopment => current == AppFlavor.development;
  static bool get isStaging => current == AppFlavor.staging;
  static bool get isProduction => current == AppFlavor.production;
}
