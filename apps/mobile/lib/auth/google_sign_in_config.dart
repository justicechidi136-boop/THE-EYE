import "package:google_sign_in/google_sign_in.dart";

import "../config/app_flavor.dart";
import "../firebase_options_staging.dart";

/// Web OAuth client ID from Firebase Console (client_type 3 in google-services.json).
/// Override at build time: --dart-define=GOOGLE_WEB_CLIENT_ID=xxxx.apps.googleusercontent.com
abstract final class GoogleSignInConfig {
  static const String _dartDefineClientId =
      String.fromEnvironment("GOOGLE_WEB_CLIENT_ID");
  static const String _developmentWebClientId = String.fromEnvironment(
    "GOOGLE_WEB_CLIENT_ID_DEVELOPMENT",
  );
  static const String _productionWebClientId = String.fromEnvironment(
    "GOOGLE_WEB_CLIENT_ID_PRODUCTION",
  );

  static String get webClientId {
    if (_dartDefineClientId.isNotEmpty) return _dartDefineClientId;
    switch (AppFlavorConfig.current) {
      case AppFlavor.development:
        if (_developmentWebClientId.isEmpty) {
          throw StateError(
            "Google web client ID is not configured for development builds.",
          );
        }
        return _developmentWebClientId;
      case AppFlavor.staging:
        return FirebaseOptionsStaging.androidGoogleWebClientId;
      case AppFlavor.production:
        if (_productionWebClientId.isEmpty) {
          throw StateError(
            "Google web client ID is not configured for production builds.",
          );
        }
        return _productionWebClientId;
    }
  }

  static GoogleSignIn create() {
    return GoogleSignIn(
      scopes: const ["email", "profile"],
      serverClientId: webClientId,
    );
  }
}
