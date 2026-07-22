/// Build-time flavor selection for Firebase and API pairing validation.
///
/// Prefer Gradle `--flavor development|staging|production|managedStaging|managedProduction`
/// (sets `FLUTTER_APP_FLAVOR`). Legacy override:
/// `--dart-define=THE_EYE_FIREBASE_ENV=staging`
enum WatchFirebaseEnv {
  development,
  staging,
  production,
}

/// Consumer builds let the user pick THE EYE as default home.
/// Managed builds are device-owner only (no DPM in consumer).
enum WatchLauncherMode {
  consumer,
  managed,
}

abstract final class WatchFlavor {
  static const _flutterFlavor = String.fromEnvironment('FLUTTER_APP_FLAVOR');
  static const _legacyEnvName = String.fromEnvironment(
    'THE_EYE_FIREBASE_ENV',
    defaultValue: '',
  );

  static WatchFirebaseEnv get firebaseEnv {
    final raw = _flutterFlavor.isNotEmpty ? _flutterFlavor : _legacyEnvName;
    switch (raw.toLowerCase()) {
      case 'development':
      case 'dev':
        return WatchFirebaseEnv.development;
      case 'production':
      case 'prod':
      case 'managedproduction':
        return WatchFirebaseEnv.production;
      case 'staging':
      case 'stg':
      case 'managedstaging':
        return WatchFirebaseEnv.staging;
      default:
        return WatchFirebaseEnv.staging;
    }
  }

  static WatchLauncherMode get launcherMode {
    final raw = _flutterFlavor.toLowerCase();
    if (raw == 'managedstaging' || raw == 'managedproduction') {
      return WatchLauncherMode.managed;
    }
    const dartMode = String.fromEnvironment('LAUNCHER_MODE');
    if (dartMode == 'managed') return WatchLauncherMode.managed;
    return WatchLauncherMode.consumer;
  }

  static bool get isManagedLauncher =>
      launcherMode == WatchLauncherMode.managed;

  static String get envName {
    switch (firebaseEnv) {
      case WatchFirebaseEnv.development:
        return 'development';
      case WatchFirebaseEnv.staging:
        return 'staging';
      case WatchFirebaseEnv.production:
        return 'production';
    }
  }

  static String get androidPackageId {
    switch (firebaseEnv) {
      case WatchFirebaseEnv.development:
        return 'com.theeye.watch.dev';
      case WatchFirebaseEnv.staging:
        return 'com.theeye.watch.staging';
      case WatchFirebaseEnv.production:
        return 'com.theeye.watch';
    }
  }

  static String get firebaseProjectId {
    switch (firebaseEnv) {
      case WatchFirebaseEnv.development:
        return 'the-eye-29cff';
      case WatchFirebaseEnv.staging:
        return 'the-eye-2stg';
      case WatchFirebaseEnv.production:
        return 'the-eye-2pd-d0217';
    }
  }

  static bool get isDevelopment => firebaseEnv == WatchFirebaseEnv.development;
  static bool get isStaging => firebaseEnv == WatchFirebaseEnv.staging;
  static bool get isProduction => firebaseEnv == WatchFirebaseEnv.production;
}
