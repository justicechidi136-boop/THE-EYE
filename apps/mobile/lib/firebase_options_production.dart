import "package:firebase_core/firebase_core.dart" show FirebaseOptions;
import "package:flutter/foundation.dart"
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Firebase options for production project `the-eye-2pd-d0217`, package `com.theeye.app`.
/// Generated from `firebase apps:sdkconfig` output.
class FirebaseOptionsProduction {
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
      "137367371675-7sikh2svb9k1c7ft8mqsmkmjpqpnav36.apps.googleusercontent.com";

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: "AIzaSyCab9jm1fneeOk0ycWUQDb6mHiBvmXJoAs",
    appId: "1:137367371675:android:7c280f69a27799b3a2ab3e",
    messagingSenderId: "137367371675",
    projectId: "the-eye-2pd-d0217",
    storageBucket: "the-eye-2pd-d0217.firebasestorage.app",
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: "AIzaSyCV75Pn_XgoLFPgY7opR_8mytYZbLq9P_Q",
    appId: "1:137367371675:ios:ec4f52caf970d4aea2ab3e",
    messagingSenderId: "137367371675",
    projectId: "the-eye-2pd-d0217",
    storageBucket: "the-eye-2pd-d0217.firebasestorage.app",
    iosBundleId: "com.theeye.app",
  );
}
