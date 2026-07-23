import "dart:async";
import "dart:convert";
import "dart:io";
import "dart:math";

import "package:crypto/crypto.dart";
import "package:firebase_auth/firebase_auth.dart";
import "package:flutter/foundation.dart";
import "package:flutter/services.dart";
import "package:google_sign_in/google_sign_in.dart";
import "package:http/http.dart" as http;
import "package:sign_in_with_apple/sign_in_with_apple.dart";

import "../config/app_flavor.dart";
import "../contracts/the_eye_api_client.dart";
import "auth_safe_log.dart";
import "auth_session_store.dart";
import "google_sign_in_config.dart";

enum SocialAuthProvider { google, apple }

enum SocialAuthStatus {
  success,
  cancelled,
  networkError,
  serverError,
  accountConflict,
  accountSuspended,
  accountDeactivated,
  providerError,
  invalidToken,
}

class SocialAuthResult {
  const SocialAuthResult({
    required this.status,
    this.session,
    this.profileComplete = true,
    this.userMessage,
  });

  final SocialAuthStatus status;
  final AuthSession? session;
  final bool profileComplete;
  final String? userMessage;

  bool get isSuccess => status == SocialAuthStatus.success;
}

class SocialAuthService {
  SocialAuthService({
    required TheEyeApiClient apiClient,
    required AuthSessionStore sessionStore,
    FirebaseAuth? firebaseAuth,
    GoogleSignIn? googleSignIn,
    Future<UserCredential?> Function()? googleCredentialFactory,
    Future<UserCredential?> Function()? appleCredentialFactory,
  })  : _apiClient = apiClient,
        _sessionStore = sessionStore,
        _firebaseAuthOverride = firebaseAuth,
        _googleSignIn = googleSignIn ?? GoogleSignInConfig.create() {
    _googleCredentialFactory =
        googleCredentialFactory ?? () => _firebaseGoogleCredential();
    _appleCredentialFactory =
        appleCredentialFactory ?? () => _firebaseAppleCredential();
  }

  final TheEyeApiClient _apiClient;
  final AuthSessionStore _sessionStore;
  final FirebaseAuth? _firebaseAuthOverride;
  final GoogleSignIn _googleSignIn;
  late final Future<UserCredential?> Function() _googleCredentialFactory;
  late final Future<UserCredential?> Function() _appleCredentialFactory;
  bool _signInInFlight = false;

  FirebaseAuth get _firebaseAuth =>
      _firebaseAuthOverride ?? FirebaseAuth.instance;

  static bool get isAppleSignInSupported {
    if (kIsWeb) return false;
    return Platform.isIOS || Platform.isAndroid;
  }

  Future<SocialAuthResult> signInWithGoogle({String? deviceId}) async {
    if (_signInInFlight) {
      return const SocialAuthResult(
        status: SocialAuthStatus.providerError,
        userMessage: "A sign-in request is already in progress.",
      );
    }

    _signInInFlight = true;
    try {
      final credential = await _googleCredentialFactory();
      if (credential == null) {
        return const SocialAuthResult(
          status: SocialAuthStatus.cancelled,
          userMessage: "Google sign-in was cancelled.",
        );
      }

      final idToken = await credential.user?.getIdToken(true);
      if (idToken == null || idToken.isEmpty) {
        return const SocialAuthResult(
          status: SocialAuthStatus.invalidToken,
          userMessage: "Unable to verify your Google sign-in. Try again.",
        );
      }

      return _exchangeProviderToken(
        idToken: idToken,
        provider: "google.com",
        deviceId: deviceId,
      );
    } on FirebaseAuthException catch (error) {
      logAuthEvent("Google provider error: ${error.code}");
      return SocialAuthResult(
        status: SocialAuthStatus.providerError,
        userMessage: _firebaseAuthMessage(error),
      );
    } on PlatformException catch (error) {
      logAuthEvent("Google platform error: ${error.code}");
      return SocialAuthResult(
        status: SocialAuthStatus.providerError,
        userMessage: _googlePlatformMessage(error),
      );
    } on SocketException {
      return SocialAuthResult(
        status: SocialAuthStatus.networkError,
        userMessage: _networkReachabilityMessage(),
      );
    } on http.ClientException {
      return SocialAuthResult(
        status: SocialAuthStatus.networkError,
        userMessage: _networkReachabilityMessage(),
      );
    } on TimeoutException {
      return SocialAuthResult(
        status: SocialAuthStatus.networkError,
        userMessage: _networkReachabilityMessage(),
      );
    } finally {
      _signInInFlight = false;
    }
  }

  Future<({bool isSuccess, String? idToken, String? userMessage})>
      obtainGoogleIdToken() async {
    if (_signInInFlight) {
      return (
        isSuccess: false,
        idToken: null,
        userMessage: "A sign-in request is already in progress.",
      );
    }
    _signInInFlight = true;
    try {
      final credential = await _googleCredentialFactory();
      if (credential == null) {
        return (
          isSuccess: false,
          idToken: null,
          userMessage: "Google sign-in was cancelled.",
        );
      }
      final idToken = await credential.user?.getIdToken(true);
      if (idToken == null || idToken.isEmpty) {
        return (
          isSuccess: false,
          idToken: null,
          userMessage: "Unable to verify your Google sign-in. Try again.",
        );
      }
      return (isSuccess: true, idToken: idToken, userMessage: null);
    } on FirebaseAuthException catch (error) {
      return (
        isSuccess: false,
        idToken: null,
        userMessage: _firebaseAuthMessage(error),
      );
    } on PlatformException catch (error) {
      return (
        isSuccess: false,
        idToken: null,
        userMessage: _googlePlatformMessage(error),
      );
    } on SocketException {
      return (
        isSuccess: false,
        idToken: null,
        userMessage: _networkReachabilityMessage(),
      );
    } on http.ClientException {
      return (
        isSuccess: false,
        idToken: null,
        userMessage: _networkReachabilityMessage(),
      );
    } on TimeoutException {
      return (
        isSuccess: false,
        idToken: null,
        userMessage: _networkReachabilityMessage(),
      );
    } finally {
      _signInInFlight = false;
    }
  }

  Future<SocialAuthResult> signInWithApple({String? deviceId}) async {
    if (!isAppleSignInSupported) {
      return const SocialAuthResult(
        status: SocialAuthStatus.providerError,
        userMessage: "Sign in with Apple is not available on this device.",
      );
    }

    if (_signInInFlight) {
      return const SocialAuthResult(
        status: SocialAuthStatus.providerError,
        userMessage: "A sign-in request is already in progress.",
      );
    }

    _signInInFlight = true;
    try {
      final credential = await _appleCredentialFactory();
      if (credential == null) {
        return const SocialAuthResult(
          status: SocialAuthStatus.cancelled,
          userMessage: "Apple sign-in was cancelled.",
        );
      }

      final idToken = await credential.user?.getIdToken(true);
      if (idToken == null || idToken.isEmpty) {
        return const SocialAuthResult(
          status: SocialAuthStatus.invalidToken,
          userMessage: "Unable to verify your Apple sign-in. Try again.",
        );
      }

      return _exchangeProviderToken(
        idToken: idToken,
        provider: "apple.com",
        deviceId: deviceId,
      );
    } on SignInWithAppleAuthorizationException catch (error) {
      if (error.code == AuthorizationErrorCode.canceled) {
        return const SocialAuthResult(
          status: SocialAuthStatus.cancelled,
          userMessage: "Apple sign-in was cancelled.",
        );
      }
      logAuthEvent("Apple provider error: ${error.code.name}");
      return SocialAuthResult(
        status: SocialAuthStatus.providerError,
        userMessage: "Apple sign-in failed. Try again.",
      );
    } on FirebaseAuthException catch (error) {
      logAuthEvent("Apple Firebase error: ${error.code}");
      return SocialAuthResult(
        status: SocialAuthStatus.providerError,
        userMessage: _firebaseAuthMessage(error),
      );
    } on SocketException {
      return SocialAuthResult(
        status: SocialAuthStatus.networkError,
        userMessage: _networkReachabilityMessage(),
      );
    } on http.ClientException {
      return SocialAuthResult(
        status: SocialAuthStatus.networkError,
        userMessage: _networkReachabilityMessage(),
      );
    } on TimeoutException {
      return SocialAuthResult(
        status: SocialAuthStatus.networkError,
        userMessage: _networkReachabilityMessage(),
      );
    } finally {
      _signInInFlight = false;
    }
  }

  Future<void> signOutProviders() async {
    await Future.wait([
      _firebaseAuth.signOut(),
      _googleSignIn.signOut(),
    ]);
  }

  Future<UserCredential?> _firebaseGoogleCredential() async {
    if (!kIsWeb && Platform.isAndroid) {
      return _firebaseGoogleCredentialAndroid();
    }
    return _firebaseGoogleCredentialWithGoogleSignIn();
  }

  /// Uses Firebase's native activity flow so the app reliably resumes after
  /// account selection (avoids google_sign_in callback issues on Android).
  Future<UserCredential?> _firebaseGoogleCredentialAndroid() async {
    final provider = GoogleAuthProvider();
    provider.addScope("email");
    provider.setCustomParameters(const {"prompt": "select_account"});
    try {
      return await _firebaseAuth
          .signInWithProvider(provider)
          .timeout(const Duration(minutes: 2));
    } on FirebaseAuthException catch (error) {
      if (_isGoogleSignInCancelled(error.code)) {
        return null;
      }
      rethrow;
    } on TimeoutException {
      logAuthEvent("Google sign-in timed out waiting for provider response");
      throw PlatformException(
        code: "google-sign-in-timeout",
        message: "Google sign-in timed out. Try again.",
      );
    }
  }

  Future<UserCredential?> _firebaseGoogleCredentialWithGoogleSignIn() async {
    if (!kIsWeb &&
        Platform.isAndroid &&
        GoogleSignInConfig.webClientId.isEmpty) {
      logAuthEvent("Google web client ID missing for Android fallback");
      throw PlatformException(
        code: "missing-google-web-client-id",
        message:
            "Google sign-in is not fully configured. Add SHA-1/SHA-256 in Firebase Console and rebuild with GOOGLE_WEB_CLIENT_ID.",
      );
    }

    final googleUser = await _googleSignIn.signIn();
    if (googleUser == null) return null;

    final googleAuth = await googleUser.authentication;
    if (googleAuth.idToken == null || googleAuth.idToken!.isEmpty) {
      throw PlatformException(
        code: "missing-id-token",
        message:
            "Google did not return an ID token. Verify Firebase SHA fingerprints and GOOGLE_WEB_CLIENT_ID.",
      );
    }

    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );
    return _firebaseAuth.signInWithCredential(credential);
  }

  bool _isGoogleSignInCancelled(String code) {
    return code == "web-context-cancelled" ||
        code == "cancelled-popup-request" ||
        code == "user-cancelled" ||
        code == "ERROR_USER_CANCELLED" ||
        code == "sign_in_canceled";
  }

  String _googlePlatformMessage(PlatformException error) {
    final code = error.code;
    if (code == "sign_in_canceled" || code == "sign_in_cancelled") {
      return "Google sign-in was cancelled.";
    }
    if (code == "sign_in_failed" ||
        code == "10" ||
        (error.message ?? "").contains("10:")) {
      return "Google sign-in is not configured for this build. Add your app SHA-1 and SHA-256 in Firebase Console (project ${AppFlavorConfig.firebaseProjectId}), download an updated google-services.json, then rebuild.";
    }
    if (code == "missing-google-web-client-id" || code == "missing-id-token") {
      return error.message ??
          "Google sign-in is not fully configured for this build.";
    }
    return "Google sign-in failed. Try again.";
  }

  Future<UserCredential?> _firebaseAppleCredential() async {
    final rawNonce = _generateNonce();
    final nonce = _sha256ofString(rawNonce);

    final appleCredential = await SignInWithApple.getAppleIDCredential(
      scopes: const [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
      nonce: nonce,
    );

    final oauthCredential = OAuthProvider("apple.com").credential(
      idToken: appleCredential.identityToken,
      rawNonce: rawNonce,
    );
    return _firebaseAuth.signInWithCredential(oauthCredential);
  }

  Future<SocialAuthResult> _exchangeProviderToken({
    required String idToken,
    required String provider,
    String? deviceId,
  }) async {
    try {
      final exchange = await _apiClient.exchangeFirebaseToken(
        idToken: idToken,
        provider: provider,
        deviceId: deviceId,
        platform: _platformName(),
      );
      await _sessionStore.save(exchange.session);
      logAuthEvent("Firebase exchange succeeded for $provider");
      return SocialAuthResult(
        status: SocialAuthStatus.success,
        session: exchange.session,
        profileComplete: exchange.profileComplete,
      );
    } on AuthApiException catch (error) {
      return _mapExchangeException(error);
    } on SocketException {
      return SocialAuthResult(
        status: SocialAuthStatus.networkError,
        userMessage: _networkReachabilityMessage(),
      );
    } on http.ClientException {
      return SocialAuthResult(
        status: SocialAuthStatus.networkError,
        userMessage: _networkReachabilityMessage(),
      );
    } on TimeoutException {
      return SocialAuthResult(
        status: SocialAuthStatus.networkError,
        userMessage: _networkReachabilityMessage(),
      );
    }
  }

  String _networkReachabilityMessage() {
    return "Google sign-in succeeded but THE EYE could not be reached at ${_apiClient.baseUrl}. "
        "On your computer, run: pnpm dev:api — then either plug in USB and run "
        "adb reverse tcp:4000 tcp:4000, or use the same Wi‑Fi and rebuild with your PC LAN IP.";
  }

  SocialAuthResult _mapExchangeException(AuthApiException error) {
    final code = error.errorCode ?? "";
    if (error.statusCode == 409 ||
        code == "ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL") {
      return SocialAuthResult(
        status: SocialAuthStatus.accountConflict,
        userMessage: error.userMessage,
      );
    }
    if (error.statusCode == 403 && code == "ACCOUNT_SUSPENDED") {
      return const SocialAuthResult(
        status: SocialAuthStatus.accountSuspended,
        userMessage:
            "Your THE EYE account is suspended. Contact support for assistance.",
      );
    }
    if (error.statusCode == 403 && code == "ACCOUNT_DEACTIVATED") {
      return const SocialAuthResult(
        status: SocialAuthStatus.accountDeactivated,
        userMessage: "Your THE EYE account is deactivated.",
      );
    }
    if (error.statusCode == 401) {
      if (error.errorCode == "FIREBASE_TOKEN_PROJECT_MISMATCH") {
        final tokenProject = error.tokenAud ?? "unknown";
        final apiProject = error.expectedProjectId ?? "the-eye-2stg";
        return SocialAuthResult(
          status: SocialAuthStatus.invalidToken,
          userMessage:
              "Firebase project mismatch: this app issued a token for `$tokenProject` "
              "but the API expects `$apiProject`. Rebuild with "
              "`flutter build apk --flavor staging --dart-define=THE_EYE_FLAVOR=staging`, "
              "or ask ops to verify FIREBASE_PROJECT_ID on the staging API.",
        );
      }
      return SocialAuthResult(
        status: SocialAuthStatus.invalidToken,
        userMessage: error.userMessage,
      );
    }
    if (error.statusCode == 429) {
      return SocialAuthResult(
        status: SocialAuthStatus.serverError,
        userMessage: error.userMessage,
      );
    }
    return SocialAuthResult(
      status: SocialAuthStatus.serverError,
      userMessage: error.userMessage,
    );
  }

  String _firebaseAuthMessage(FirebaseAuthException error) {
    switch (error.code) {
      case "account-exists-with-different-credential":
        return "This email is linked to another sign-in method. Use your original method, then link this provider from Settings.";
      case "user-disabled":
        return "This sign-in account is disabled.";
      case "credential-already-in-use":
        return "This provider is already linked to another THE EYE account.";
      default:
        return "Sign-in failed. Try again.";
    }
  }

  String _generateNonce([int length = 32]) {
    const charset =
        "0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._";
    final random = Random.secure();
    return List.generate(length, (_) => charset[random.nextInt(charset.length)])
        .join();
  }

  String _sha256ofString(String input) {
    final bytes = utf8.encode(input);
    return sha256.convert(bytes).toString();
  }

  String _platformName() {
    if (kIsWeb) return "web";
    if (Platform.isIOS) return "ios";
    return "android";
  }
}
