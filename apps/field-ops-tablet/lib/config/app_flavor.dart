/// Build-time flavor selection for Firebase and API pairing validation.
enum FieldFirebaseEnv {
  staging,
  production,
}

abstract final class AppFlavor {
  static const _flutterFlavor = String.fromEnvironment('FLUTTER_APP_FLAVOR');
  static const _legacyEnvName = String.fromEnvironment(
    'THE_EYE_FIREBASE_ENV',
    defaultValue: '',
  );

  static FieldFirebaseEnv get firebaseEnv {
    final raw = _flutterFlavor.isNotEmpty ? _flutterFlavor : _legacyEnvName;
    switch (raw.toLowerCase()) {
      case 'production':
      case 'prod':
        return FieldFirebaseEnv.production;
      case 'staging':
      case 'stg':
      default:
        return FieldFirebaseEnv.staging;
    }
  }

  static String get envName {
    switch (firebaseEnv) {
      case FieldFirebaseEnv.staging:
        return 'staging';
      case FieldFirebaseEnv.production:
        return 'production';
    }
  }

  static String get androidPackageId {
    switch (firebaseEnv) {
      case FieldFirebaseEnv.staging:
        return 'com.theeye.fieldops.staging';
      case FieldFirebaseEnv.production:
        return 'com.theeye.fieldops';
    }
  }

  static String get firebaseProjectId {
    switch (firebaseEnv) {
      case FieldFirebaseEnv.staging:
        return 'the-eye-2stg';
      case FieldFirebaseEnv.production:
        return 'the-eye-2pd-d0217';
    }
  }

  static bool get isStaging => firebaseEnv == FieldFirebaseEnv.staging;
  static bool get isProduction => firebaseEnv == FieldFirebaseEnv.production;
}
