import "package:firebase_core/firebase_core.dart" show FirebaseOptions;
import "package:flutter/foundation.dart"
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Firebase options for staging project `the-eye-2stg`, package `com.theeye.app.staging`.
/// Generated from `firebase apps:sdkconfig` output.
class FirebaseOptionsStaging {
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
      "767357461507-rvoedt7hr8452sehgi2qs3v8q69vovuj.apps.googleusercontent.com";

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: "AIzaSyBm3_toFsNo0ZHbChLmww2y2bSLiTHvggk",
    appId: "1:767357461507:android:325b76c7d73640b2919a36",
    messagingSenderId: "767357461507",
    projectId: "the-eye-2stg",
    storageBucket: "the-eye-2stg.firebasestorage.app",
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: "AIzaSyDLSrjpwBPWPk-XBHPJNBBDy45rjS4wFkI",
    appId: "1:767357461507:ios:ed01b6493b1b5562919a36",
    messagingSenderId: "767357461507",
    projectId: "the-eye-2stg",
    storageBucket: "the-eye-2stg.firebasestorage.app",
    iosBundleId: "com.theeye.app.staging",
  );
}
