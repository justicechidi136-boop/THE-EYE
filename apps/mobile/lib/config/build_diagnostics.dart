import "package:flutter/foundation.dart";

import "../config/app_flavor.dart";
import "the_eye_api_config.dart";

/// Non-secret build and runtime identity for staging diagnostics.
abstract final class BuildDiagnostics {
  static const appVersion =
      String.fromEnvironment("THE_EYE_APP_VERSION", defaultValue: "0.1.0+1");

  static const buildSha =
      String.fromEnvironment("THE_EYE_BUILD_SHA", defaultValue: "unknown");

  static const buildTimestamp =
      String.fromEnvironment("THE_EYE_BUILD_TIMESTAMP", defaultValue: "unknown");

  /// Last 8 hex chars of release/debug signing cert SHA-1 (no secrets).
  static const certSha1Suffix = String.fromEnvironment(
    "THE_EYE_CERT_SHA1_SUFFIX",
    defaultValue: "unknown",
  );

  static String get environment {
    try {
      return AppFlavorConfig.current.name;
    } catch (_) {
      return "unknown";
    }
  }

  static String get apiHostname {
    try {
      return Uri.parse(TheEyeApiConfig.resolveBaseUrl()).host;
    } catch (_) {
      return "unknown";
    }
  }

  static String get firebaseProjectId {
    try {
      return AppFlavorConfig.firebaseProjectId;
    } catch (_) {
      return "unknown";
    }
  }

  static String get packageName {
    try {
      return AppFlavorConfig.androidApplicationId;
    } catch (_) {
      return kIsWeb ? "web" : "unknown";
    }
  }

  static List<(String label, String value)> snapshot() {
    return [
      ("App version", appVersion),
      ("Build SHA", buildSha),
      ("Environment", environment),
      ("Package", packageName),
      ("API host", apiHostname),
      ("Firebase project", firebaseProjectId),
      ("Build time", buildTimestamp),
      ("Cert SHA-1 suffix", certSha1Suffix),
    ];
  }
}
