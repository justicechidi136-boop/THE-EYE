import "package:flutter/services.dart";

import "../config/app_flavor.dart";
import "../config/build_diagnostics.dart";
import "auth_safe_log.dart";

/// Layers for Google Sign-In failure classification (staging diagnostics).
enum GoogleAuthFailureLayer {
  accountChooserNotOpened(1, "Account chooser did not open"),
  accountSelectionFailed(2, "Account selection failed"),
  firebaseCredentialFailed(3, "Firebase credential creation failed"),
  firebaseSignInFailed(4, "Firebase signInWithCredential failed"),
  firebaseIdTokenFailed(5, "Firebase ID token retrieval failed"),
  backendExchangeFailed(6, "Backend token exchange failed"),
  backendVerificationFailed(7, "Backend token verification failed"),
  sessionOrNavigationFailed(8, "Session storage or navigation failed"),
  unknown(0, "Unknown layer");

  const GoogleAuthFailureLayer(this.number, this.label);

  final int number;
  final String label;
}

class GoogleAuthDiagnosticSnapshot {
  const GoogleAuthDiagnosticSnapshot({
    required this.layer,
    this.firebaseProjectId = "",
    this.packageName = "",
    this.googleStatusCode = "",
    this.firebaseExceptionCode = "",
    this.backendHttpStatus = "",
    this.apiErrorCode = "",
    this.requestId = "",
    this.referenceId = "",
  });

  final GoogleAuthFailureLayer layer;
  final String firebaseProjectId;
  final String packageName;
  final String googleStatusCode;
  final String firebaseExceptionCode;
  final String backendHttpStatus;
  final String apiErrorCode;
  final String requestId;
  final String referenceId;

  Map<String, String> toSafeMap() {
    return {
      "layer": "${layer.number}",
      "layerLabel": layer.label,
      "firebaseProject": firebaseProjectId,
      "package": packageName,
      "googleStatus": googleStatusCode,
      "firebaseCode": firebaseExceptionCode,
      "httpStatus": backendHttpStatus,
      "apiError": apiErrorCode,
      "requestId": requestId,
      "referenceId": referenceId,
    };
  }
}

abstract final class AuthDiagnostics {
  static GoogleAuthDiagnosticSnapshot forFirebaseAuthException(String code) {
    final layer = _isCancelled(code)
        ? GoogleAuthFailureLayer.accountSelectionFailed
        : _isConfigError(code)
            ? GoogleAuthFailureLayer.accountSelectionFailed
            : GoogleAuthFailureLayer.firebaseSignInFailed;
    return _base(layer, firebaseExceptionCode: code);
  }

  static GoogleAuthDiagnosticSnapshot forPlatformException(
    PlatformException error,
  ) {
    final code = error.code;
    final layer = code == "sign_in_canceled" || code == "sign_in_cancelled"
        ? GoogleAuthFailureLayer.accountSelectionFailed
        : _isGoogleConfigPlatformCode(code)
            ? GoogleAuthFailureLayer.accountSelectionFailed
            : GoogleAuthFailureLayer.firebaseCredentialFailed;
    return _base(
      layer,
      googleStatusCode: code,
      firebaseExceptionCode: error.message ?? "",
    );
  }

  static GoogleAuthDiagnosticSnapshot forBackendExchange({
    required int httpStatus,
    String apiErrorCode = "",
    String requestId = "",
  }) {
    final layer = httpStatus >= 500
        ? GoogleAuthFailureLayer.backendExchangeFailed
        : GoogleAuthFailureLayer.backendVerificationFailed;
    return _base(
      layer,
      backendHttpStatus: "$httpStatus",
      apiErrorCode: apiErrorCode,
      requestId: requestId,
    );
  }

  static GoogleAuthDiagnosticSnapshot forIdTokenFailure() {
    return _base(GoogleAuthFailureLayer.firebaseIdTokenFailed);
  }

  static void logSnapshot(GoogleAuthDiagnosticSnapshot snapshot) {
    String sanitize(String value) =>
        value.replaceAll(RegExp(r"token", caseSensitive: false), "tkn");
    final parts = snapshot.toSafeMap().entries
        .where((entry) => entry.value.isNotEmpty)
        .map((entry) => "${entry.key}=${sanitize(entry.value)}")
        .join(" ");
    logAuthEvent("Google auth diagnostic $parts");
  }

  static GoogleAuthDiagnosticSnapshot _base(
    GoogleAuthFailureLayer layer, {
    String googleStatusCode = "",
    String firebaseExceptionCode = "",
    String backendHttpStatus = "",
    String apiErrorCode = "",
    String requestId = "",
  }) {
    final referenceId =
        "GA-${DateTime.now().toUtc().millisecondsSinceEpoch}-${layer.number}";
    return GoogleAuthDiagnosticSnapshot(
      layer: layer,
      firebaseProjectId: _firebaseProjectId(),
      packageName: BuildDiagnostics.packageName,
      googleStatusCode: googleStatusCode,
      firebaseExceptionCode: firebaseExceptionCode,
      backendHttpStatus: backendHttpStatus,
      apiErrorCode: apiErrorCode,
      requestId: requestId,
      referenceId: referenceId,
    );
  }

  static String _firebaseProjectId() {
    try {
      return AppFlavorConfig.firebaseProjectId;
    } catch (_) {
      return BuildDiagnostics.firebaseProjectId;
    }
  }

  static bool _isCancelled(String code) {
    return code == "web-context-cancelled" ||
        code == "cancelled-popup-request" ||
        code == "user-cancelled" ||
        code == "ERROR_USER_CANCELLED" ||
        code == "sign_in_canceled";
  }

  static bool _isConfigError(String code) {
    return code == "invalid-credential" ||
        code == "operation-not-allowed" ||
        code == "app-not-authorized";
  }

  static bool _isGoogleConfigPlatformCode(String code) {
    return code == "sign_in_failed" ||
        code == "10" ||
        code == "missing-google-web-client-id" ||
        code == "missing-id-token" ||
        code == "google-sign-in-timeout";
  }
}
