import "package:firebase_core/firebase_core.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/auth/google_sign_in_config.dart";
import "package:the_eye_mobile/config/app_flavor.dart";
import "package:the_eye_mobile/config/firebase_bootstrap.dart";
import "package:the_eye_mobile/config/the_eye_api_config.dart";
import "package:the_eye_mobile/firebase_options_production.dart";
import "package:the_eye_mobile/firebase_options_staging.dart";

void main() {
  group("AppFlavorConfig", () {
    test("defaults to production when no flavor is set", () {
      expect(AppFlavorConfig.current, AppFlavor.production);
      expect(AppFlavorConfig.androidApplicationId, "com.theeye.app");
      expect(AppFlavorConfig.firebaseProjectId, "the-eye-2pd-d0217");
      expect(AppFlavorConfig.firebaseEnvName, "production");
      expect(AppFlavorConfig.displayName, "THE EYE");
    });
  });

  group("Firebase options per flavor", () {
    test("staging options target the-eye-2stg", () {
      expect(
        FirebaseOptionsStaging.android.projectId,
        "the-eye-2stg",
      );
      expect(
        FirebaseOptionsStaging.android.appId,
        "1:767357461507:android:325b76c7d73640b2919a36",
      );
      expect(
        FirebaseOptionsStaging.android.messagingSenderId,
        "767357461507",
      );
      expect(
        FirebaseOptionsStaging.ios.iosBundleId,
        "com.theeye.app.staging",
      );
    });

    test("production options target the-eye-2pd-d0217", () {
      expect(
        FirebaseOptionsProduction.android.projectId,
        "the-eye-2pd-d0217",
      );
      expect(
        FirebaseOptionsProduction.android.appId,
        "1:137367371675:android:7c280f69a27799b3a2ab3e",
      );
      expect(
        FirebaseOptionsProduction.android.messagingSenderId,
        "137367371675",
      );
      expect(FirebaseOptionsProduction.ios.iosBundleId, "com.theeye.app");
    });
  });

  group("assertFirebaseEnvMatchesFlavor", () {
    test("allows matching production project", () {
      expect(
        () => assertFirebaseEnvMatchesFlavor(
          AppFlavor.production,
          FirebaseOptionsProduction.android,
        ),
        returnsNormally,
      );
    });

    test("allows matching staging project", () {
      expect(
        () => assertFirebaseEnvMatchesFlavor(
          AppFlavor.staging,
          FirebaseOptionsStaging.android,
        ),
        returnsNormally,
      );
    });

    test("rejects staging project in production flavor", () {
      const wrongProject = FirebaseOptions(
        apiKey: "test-key",
        appId: "test-app",
        messagingSenderId: "123",
        projectId: "the-eye-2stg",
      );
      expect(
        () => assertFirebaseEnvMatchesFlavor(AppFlavor.production, wrongProject),
        throwsStateError,
      );
    });

    test("rejects production project in staging flavor", () {
      const wrongProject = FirebaseOptions(
        apiKey: "test-key",
        appId: "test-app",
        messagingSenderId: "123",
        projectId: "the-eye-2pd-d0217",
      );
      expect(
        () => assertFirebaseEnvMatchesFlavor(AppFlavor.staging, wrongProject),
        throwsStateError,
      );
    });
  });

  group("GoogleSignInConfig", () {
    test("production build uses production web client ID", () {
      expect(
        GoogleSignInConfig.webClientId,
        FirebaseOptionsProduction.androidGoogleWebClientId,
      );
    });
  });

  group("TheEyeApiConfig", () {
    test("production build uses production API URL", () {
      expect(
        TheEyeApiConfig.resolveBaseUrl(),
        "https://api.theeye.com.ng/v1",
      );
    });
  });
}
