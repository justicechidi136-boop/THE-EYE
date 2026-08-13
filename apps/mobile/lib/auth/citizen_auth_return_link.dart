import "../config/app_flavor.dart";

/// Safe auth-return deep links after password reset / account recovery (AUTH-007).
/// Never carries reset/recovery tokens or credentials.
abstract final class CitizenAuthReturnLink {
  static const allowedResults = <String>{
    "PASSWORD_RESET_SUCCESS",
    "ACCOUNT_RECOVERY_SUCCESS",
    "PASSWORD_RESET_REQUIRED",
    "ACCOUNT_RECOVERY_CONTINUE",
  };

  static String get scheme {
    switch (AppFlavorConfig.current) {
      case AppFlavor.development:
        return "theeye-dev";
      case AppFlavor.staging:
        return "theeye-staging";
      case AppFlavor.production:
        return "theeye";
    }
  }

  /// Canonical in-app destination — existing citizen sign-in route only.
  static const signInRoute = "/login";

  static bool isCitizenAuthReturnUri(Uri uri, {String? expectedScheme}) {
    final expected = expectedScheme ?? scheme;
    if (uri.scheme != expected) return false;
    if (uri.host != "auth") return false;
    final path = uri.path.replaceAll(RegExp(r"/+$"), "");
    return path == "/login" || path.isEmpty;
  }

  /// Returns a safe status message for the sign-in screen, or null if invalid.
  static String? resolveSignInMessage(Uri uri, {String? expectedScheme}) {
    if (!isCitizenAuthReturnUri(uri, expectedScheme: expectedScheme)) {
      return null;
    }
    final result = uri.queryParameters["result"]?.trim() ?? "";
    if (!allowedResults.contains(result)) {
      return "Return to THE EYE and sign in.";
    }
    switch (result) {
      case "PASSWORD_RESET_SUCCESS":
        return "Password updated. Sign in with your new password.";
      case "ACCOUNT_RECOVERY_SUCCESS":
      case "ACCOUNT_RECOVERY_CONTINUE":
        return "Account recovery confirmed. Continue sign-in in THE EYE.";
      case "PASSWORD_RESET_REQUIRED":
      default:
        return "Return to THE EYE and sign in.";
    }
  }

  /// Builds the same custom-scheme URL the web success CTA emits (no tokens).
  static Uri buildReturnUri(String result, {String? forScheme}) {
    return Uri(
      scheme: forScheme ?? scheme,
      host: "auth",
      path: "/login",
      queryParameters: {"result": result},
    );
  }

  /// Rejects admin / field / watch schemes and http(s) admin login URLs.
  static bool isForbiddenAdminDestination(Uri uri) {
    final host = uri.host.toLowerCase();
    final path = uri.path.toLowerCase();
    if (host.contains("dashboard") && path.contains("login")) return true;
    if (uri.scheme == "https" || uri.scheme == "http") {
      if (path == "/login" || path.startsWith("/login/")) {
        if (host.contains("dashboard") || host.contains("admin")) return true;
      }
    }
    return false;
  }
}
