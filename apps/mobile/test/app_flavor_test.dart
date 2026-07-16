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
    test("requires an explicit flavor at compile time", () {
      if (const String.fromEnvironment("THE_EYE_FLAVOR").isNotEmpty ||
          const String.fromEnvironment("FLUTTER_APP_FLAVOR").isNotEmpty) {
        expect(AppFlavorConfig.current, isNotNull);
        return;
      }
      expect(() => AppFlavorConfig.current, throwsStateError);
    });
  });

  group("AppFlavorConfig with production dart-define", () {
    test("targets production project and package", () {
      // Run full suite with: flutter test --dart-define=THE_EYE_FLAVOR=production
      if (const String.fromEnvironment("THE_EYE_FLAVOR") != "production") {
        return;
      }
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
      if (const String.fromEnvironment("THE_EYE_FLAVOR") != "production") {
        return;
      }
      expect(
        GoogleSignInConfig.webClientId,
        FirebaseOptionsProduction.androidGoogleWebClientId,
      );
    });
  });

  group("TheEyeApiConfig", () {
    test("production build uses production API URL", () {
      if (const String.fromEnvironment("THE_EYE_FLAVOR") != "production") {
        return;
      }
      expect(
        TheEyeApiConfig.resolveBaseUrl(),
        "https://api.theeye.com.ng/v1",
      );
    });

    test("detects production, staging, and local dev API hosts", () {
      expect(
        TheEyeApiConfig.isProductionApiUrl("https://api.theeye.com.ng/v1"),
        isTrue,
      );
      expect(
        TheEyeApiConfig.isStagingApiUrl(
          "https://staging-api.theeye.com.ng/v1",
        ),
        isTrue,
      );
      expect(
        TheEyeApiConfig.isProductionApiUrl(
          "https://staging-api.theeye.com.ng/v1",
        ),
        isFalse,
      );
      expect(
        TheEyeApiConfig.isLocalDevUrl("http://10.99.68.107:4000/v1"),
        isTrue,
      );
    });
  });

  group("assertMobileApiBaseUrlMatchesFlavor", () {
    test("allows staging API for staging flavor", () {
      expect(
        () => assertMobileApiBaseUrlMatchesFlavor(
          AppFlavor.staging,
          "https://staging-api.theeye.com.ng/v1",
        ),
        returnsNormally,
      );
    });

    test("rejects production API for staging flavor", () {
      expect(
        () => assertMobileApiBaseUrlMatchesFlavor(
          AppFlavor.staging,
          "https://api.theeye.com.ng/v1",
        ),
        throwsStateError,
      );
    });

    test("rejects staging API for production flavor", () {
      expect(
        () => assertMobileApiBaseUrlMatchesFlavor(
          AppFlavor.production,
          "https://staging-api.theeye.com.ng/v1",
        ),
        throwsStateError,
      );
    });

    test("rejects local dev API for staging flavor", () {
      expect(
        () => assertMobileApiBaseUrlMatchesFlavor(
          AppFlavor.staging,
          "http://10.99.68.107:4000/v1",
        ),
        throwsStateError,
      );
    });

    test("allows local dev API for development flavor", () {
      expect(
        () => assertMobileApiBaseUrlMatchesFlavor(
          AppFlavor.development,
          "http://10.0.2.2:4000/v1",
        ),
        returnsNormally,
      );
    });
  });
}
