import "package:google_sign_in/google_sign_in.dart";

import "../config/app_flavor.dart";
import "../firebase_options_development.dart";
import "../firebase_options_production.dart";
import "../firebase_options_staging.dart";

/// Web OAuth client ID from Firebase Console (client_type 3 in google-services.json).
/// Override at build time: --dart-define=GOOGLE_WEB_CLIENT_ID=xxxx.apps.googleusercontent.com
abstract final class GoogleSignInConfig {
  static const String _dartDefineClientId =
      String.fromEnvironment("GOOGLE_WEB_CLIENT_ID");

  static String get webClientId {
    if (_dartDefineClientId.isNotEmpty) return _dartDefineClientId;
    switch (AppFlavorConfig.current) {
      case AppFlavor.development:
        return FirebaseOptionsDevelopment.androidGoogleWebClientId;
      case AppFlavor.staging:
        return FirebaseOptionsStaging.androidGoogleWebClientId;
      case AppFlavor.production:
        return FirebaseOptionsProduction.androidGoogleWebClientId;
    }
  }

  static GoogleSignIn create() {
    return GoogleSignIn(
      scopes: const ["email", "profile"],
      serverClientId: webClientId,
    );
  }
}
