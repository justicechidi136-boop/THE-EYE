import "package:firebase_core/firebase_core.dart" show FirebaseOptions;
import "package:flutter/foundation.dart"
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Firebase options for dev project `the-eye-29cff`, package `com.theeye.app.dev`.
/// Generated from `firebase apps:sdkconfig` output.
class FirebaseOptionsDevelopment {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError("THE EYE mobile web Firebase is not configured.");
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError("Firebase is not supported on this platform.");
    }
  }

  /// Web OAuth client (client_type 3 in google-services.json).
  static const String androidGoogleWebClientId =
      "997235004215-6jvr3913h216khukep22jciss97vpg31.apps.googleusercontent.com";

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: "AIzaSyAIPKo_OIDob4zOnrWMy3cuxadu3hXuW8s",
    appId: "1:997235004215:android:b905a52ae50e247491c0b2",
    messagingSenderId: "997235004215",
    projectId: "the-eye-29cff",
    storageBucket: "the-eye-29cff.firebasestorage.app",
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: "AIzaSyAG4WZGhJyFTiUBSa6jV0mZrJQ_Yjg5G10",
    appId: "1:997235004215:ios:541ca793a49ce7a891c0b2",
    messagingSenderId: "997235004215",
    projectId: "the-eye-29cff",
    storageBucket: "the-eye-29cff.firebasestorage.app",
    iosBundleId: "com.theeye.app.dev",
  );
}
