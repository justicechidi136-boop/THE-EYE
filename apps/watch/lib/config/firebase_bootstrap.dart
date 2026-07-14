import 'package:firebase_core/firebase_core.dart';

import '../firebase_options_development.dart';
import '../firebase_options_production.dart';
import '../firebase_options_staging.dart';
import 'watch_flavor.dart';

class FirebaseBootstrapResult {
  const FirebaseBootstrapResult({
    required this.initialized,
    this.errorMessage,
  });

  final bool initialized;
  final String? errorMessage;
}

bool _firebaseOptionsConfigured(FirebaseOptions options) {
  return !options.apiKey.startsWith('REPLACE_WITH_') &&
      !options.appId.startsWith('REPLACE_WITH_');
}

FirebaseOptions _optionsForEnv(WatchFirebaseEnv env) {
  switch (env) {
    case WatchFirebaseEnv.development:
      return FirebaseOptionsDevelopment.currentPlatform;
    case WatchFirebaseEnv.staging:
      return FirebaseOptionsStaging.currentPlatform;
    case WatchFirebaseEnv.production:
      return FirebaseOptionsProduction.currentPlatform;
  }
}

void assertWatchFirebaseEnvMatchesFlavor(
  WatchFirebaseEnv env,
  FirebaseOptions options,
) {
  final expected = switch (env) {
    WatchFirebaseEnv.development => 'the-eye-29cff',
    WatchFirebaseEnv.staging => 'the-eye-2stg',
    WatchFirebaseEnv.production => 'the-eye-2pd-d0217',
  };
  if (options.projectId != expected) {
    throw StateError(
      'Environment guard: ${env.name} build cannot initialize Firebase '
      'project `${options.projectId}`. Expected `$expected`.',
    );
  }
}

Future<FirebaseBootstrapResult> initializeWatchFirebase() async {
  if (Firebase.apps.isNotEmpty) {
    return const FirebaseBootstrapResult(initialized: true);
  }

  final env = WatchFlavor.firebaseEnv;
  final options = _optionsForEnv(env);

  if (!_firebaseOptionsConfigured(options)) {
    return FirebaseBootstrapResult(
      initialized: false,
      errorMessage:
          'Firebase options for ${WatchFlavor.firebaseProjectId} are not configured. '
          'Add google-services.json and update firebase_options_${WatchFlavor.envName}.dart.',
    );
  }

  try {
    assertWatchFirebaseEnvMatchesFlavor(env, options);
    await Firebase.initializeApp(options: options);
    return const FirebaseBootstrapResult(initialized: true);
  } on FirebaseException catch (error) {
    return FirebaseBootstrapResult(
      initialized: false,
      errorMessage: error.message ?? 'Firebase initialization failed',
    );
  } catch (error) {
    return FirebaseBootstrapResult(
      initialized: false,
      errorMessage: error.toString(),
    );
  }
}
