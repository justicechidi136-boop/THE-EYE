import "package:firebase_core/firebase_core.dart";

import "../firebase_options_development.dart";
import "../firebase_options_production.dart";
import "../firebase_options_staging.dart";
import "app_flavor.dart";

/// Ensures a build flavor cannot initialize the wrong Firebase project.
void assertFirebaseEnvMatchesFlavor(
  AppFlavor flavor,
  FirebaseOptions options,
) {
  final expected = switch (flavor) {
    AppFlavor.development => "the-eye-29cff",
    AppFlavor.staging => "the-eye-2stg",
    AppFlavor.production => "the-eye-2pd-d0217",
  };
  if (options.projectId != expected) {
    throw StateError(
      "Environment guard: ${flavor.name} build cannot initialize Firebase "
      "project `${options.projectId}`. Expected `$expected`.",
    );
  }
}

bool _firebaseOptionsConfigured(FirebaseOptions options) {
  return !options.apiKey.startsWith("REPLACE_WITH_") &&
      !options.appId.startsWith("REPLACE_WITH_");
}

FirebaseOptions firebaseOptionsForFlavor(AppFlavor flavor) {
  switch (flavor) {
    case AppFlavor.development:
      return FirebaseOptionsDevelopment.currentPlatform;
    case AppFlavor.staging:
      return FirebaseOptionsStaging.currentPlatform;
    case AppFlavor.production:
      return FirebaseOptionsProduction.currentPlatform;
  }
}

/// Initializes Firebase for the active [AppFlavorConfig.current] flavor.
Future<void> initializeMobileFirebase() async {
  final flavor = AppFlavorConfig.current;
  final options = firebaseOptionsForFlavor(flavor);

  if (!_firebaseOptionsConfigured(options)) {
    throw StateError(
      "Firebase options for ${flavor.name} (${AppFlavorConfig.firebaseProjectId}) "
      "are not configured. Register the app in Firebase Console and update "
      "firebase_options_${flavor.name}.dart plus google-services.json.",
    );
  }

  assertFirebaseEnvMatchesFlavor(flavor, options);
  await Firebase.initializeApp(options: options);
}
