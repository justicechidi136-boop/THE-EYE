import "dart:convert";
import "dart:async";
import "dart:io";

import "package:http/http.dart" as http;

import "../contracts/the_eye_api_client.dart";
import "../settings/language_region_preference_store.dart";
import "auth_safe_log.dart";
import "auth_session_store.dart";
import "auth_validation.dart";

enum AuthRequestStatus {
  success,
  validationError,
  invalidCredentials,
  rateLimited,
  networkError,
  serverError,
  otpExpired,
  otpInvalid,
  otpLocked,
  otpAlreadyUsed,
  otpMissing,
  emailAlreadyRegistered,
}

enum SessionRestoreStatus {
  unauthenticated,
  restored,
  profileIncomplete,
  failed,
}

class SessionRestoreResult {
  const SessionRestoreResult({
    required this.status,
    this.session,
  });

  final SessionRestoreStatus status;
  final AuthSession? session;

  bool get isAuthenticated =>
      status == SessionRestoreStatus.restored ||
      status == SessionRestoreStatus.profileIncomplete;
}

class AuthRequestResult {
  const AuthRequestResult({
    required this.status,
    this.session,
    this.userMessage,
    this.fieldErrors = const {},
    this.profileComplete = true,
  });

  final AuthRequestStatus status;
  final AuthSession? session;
  final String? userMessage;
  final Map<String, String> fieldErrors;
  final bool profileComplete;

  bool get isSuccess => status == AuthRequestStatus.success;
}

class AuthService {
  AuthService({
    required TheEyeApiClient apiClient,
    required AuthSessionStore sessionStore,
    LanguageRegionPreferenceStore? languageRegionPreferenceStore,
  })  : _apiClient = apiClient,
        _sessionStore = sessionStore,
        _languageRegionPreferenceStore = languageRegionPreferenceStore;

  final TheEyeApiClient _apiClient;
  final AuthSessionStore _sessionStore;
  final LanguageRegionPreferenceStore? _languageRegionPreferenceStore;
  bool _otpRequestInFlight = false;
  Future<AuthSession?>? _refreshInFlight;

  Future<AuthRequestResult> login({
    required String identifier,
    required String password,
  }) async {
    final validation =
        validateLoginForm(identifier: identifier, password: password);
    if (!validation.isEmpty) {
      return AuthRequestResult(
        status: AuthRequestStatus.validationError,
        userMessage: "Check the highlighted fields before continuing.",
        fieldErrors: validation.values,
      );
    }

    final parsed = parseLoginIdentifier(identifier);
    try {
      final session = await _apiClient.login(
        email: parsed.kind == LoginIdentifierKind.email ? parsed.email : null,
        phone: parsed.kind == LoginIdentifierKind.phone ? parsed.phone : null,
        password: password,
      );
      await _sessionStore.save(session);
      final profileComplete = await _resolveProfileComplete(session);
      logAuthEvent("Auth login succeeded for ${parsed.kind.name} identifier");
      return AuthRequestResult(
        status: AuthRequestStatus.success,
        session: session,
        profileComplete: profileComplete,
      );
    } on AuthApiException catch (error) {
      return _mapAuthException(error);
    } on SocketException {
      return const AuthRequestResult(
        status: AuthRequestStatus.networkError,
        userMessage:
            "Unable to reach THE EYE right now. Your details are still here — try again.",
      );
    } on http.ClientException {
      return const AuthRequestResult(
        status: AuthRequestStatus.networkError,
        userMessage:
            "Connection failed. Your details are still here — try again.",
      );
    }
  }

  Future<AuthRequestResult> register({
    required String email,
    required String password,
    required String confirmPassword,
    required String firstName,
    required String lastName,
  }) async {
    final validation = validateRegisterForm(
      email: email,
      password: password,
      confirmPassword: confirmPassword,
      firstName: firstName,
      lastName: lastName,
    );
    if (!validation.isEmpty) {
      return AuthRequestResult(
        status: AuthRequestStatus.validationError,
        userMessage: "Check the highlighted fields before continuing.",
        fieldErrors: validation.values,
      );
    }

    try {
      final exchange = await _apiClient.register(
        email: email.trim().toLowerCase(),
        password: password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      );
      await _sessionStore.save(exchange.session);
      logAuthEvent("Auth registration succeeded for email");
      return AuthRequestResult(
        status: AuthRequestStatus.success,
        session: exchange.session,
        profileComplete: exchange.profileComplete,
      );
    } on AuthApiException catch (error) {
      return _mapAuthException(error);
    } on SocketException {
      return const AuthRequestResult(
        status: AuthRequestStatus.networkError,
        userMessage:
            "Unable to reach THE EYE right now. Your details are still here — try again.",
      );
    } on http.ClientException {
      return const AuthRequestResult(
        status: AuthRequestStatus.networkError,
        userMessage:
            "Connection failed. Your details are still here — try again.",
      );
    }
  }

  Future<AuthRequestResult> requestPasswordReset(String identifier) async {
    final parsed = parseLoginIdentifier(identifier);
    if (parsed.kind != LoginIdentifierKind.email ||
        !isValidEmail(identifier.trim())) {
      return const AuthRequestResult(
        status: AuthRequestStatus.validationError,
        userMessage: "Enter the email address linked to your account.",
        fieldErrors: {"identifier": "Enter a valid email address."},
      );
    }

    try {
      await _apiClient.requestPasswordReset(email: parsed.email!);
      logAuthEvent("Reset request accepted");
      return const AuthRequestResult(
        status: AuthRequestStatus.success,
        userMessage:
            "If an account matches that email, password-reset instructions have been sent.",
      );
    } on AuthApiException catch (error) {
      return _mapRecoveryRequestException(error);
    } on TimeoutException {
      return _recoveryNetworkFailure();
    } on SocketException {
      return _recoveryNetworkFailure();
    } on http.ClientException {
      return _recoveryNetworkFailure();
    } catch (_) {
      return _recoveryUnexpectedFailure();
    }
  }

  Future<AuthRequestResult> requestAccountRecovery(String email) async {
    if (!isValidEmail(email.trim())) {
      return const AuthRequestResult(
        status: AuthRequestStatus.validationError,
        userMessage: "Enter the email linked to your Google account.",
        fieldErrors: {"email": "Enter a valid email address."},
      );
    }
    try {
      await _apiClient.requestAccountRecovery(
          email: email.trim().toLowerCase());
      logAuthEvent("Account recovery requested");
      return const AuthRequestResult(
        status: AuthRequestStatus.success,
        userMessage:
            "If an account matches that information, recovery instructions have been sent.",
      );
    } on AuthApiException catch (error) {
      return _mapRecoveryRequestException(error);
    } on TimeoutException {
      return _recoveryNetworkFailure();
    } on SocketException {
      return _recoveryNetworkFailure();
    } on http.ClientException {
      return _recoveryNetworkFailure();
    } catch (_) {
      return _recoveryUnexpectedFailure();
    }
  }

  Future<AuthRequestResult> verifyAccountRecovery(String token) async {
    try {
      await _apiClient.verifyAccountRecovery(token: token);
      return const AuthRequestResult(status: AuthRequestStatus.success);
    } on AuthApiException catch (error) {
      return _mapAuthException(error);
    } on SocketException {
      return const AuthRequestResult(
        status: AuthRequestStatus.networkError,
        userMessage: "Unable to reach THE EYE right now. Try again shortly.",
      );
    }
  }

  Future<AuthRequestResult> completeAccountRecovery({
    required String token,
    required String idToken,
    required String provider,
  }) async {
    try {
      final session = await _apiClient.completeAccountRecovery(
        token: token,
        idToken: idToken,
        provider: provider,
      );
      await _sessionStore.save(session);
      logAuthEvent("Account recovery completed");
      return AuthRequestResult(
        status: AuthRequestStatus.success,
        session: session,
        profileComplete: true,
      );
    } on AuthApiException catch (error) {
      return _mapAuthException(error);
    } on SocketException {
      return const AuthRequestResult(
        status: AuthRequestStatus.networkError,
        userMessage: "Unable to reach THE EYE right now. Try again shortly.",
      );
    }
  }

  Future<AuthRequestResult> requestPhoneOtp(String phone,
      {String purpose = "login"}) async {
    if (_otpRequestInFlight) {
      return const AuthRequestResult(
        status: AuthRequestStatus.rateLimited,
        userMessage: "An OTP request is already in progress.",
      );
    }

    final normalized = normalizePhoneNumber(phone);
    if (!isValidPhoneNumber(normalized)) {
      return const AuthRequestResult(
        status: AuthRequestStatus.validationError,
        userMessage: "Enter a valid phone number.",
        fieldErrors: {"identifier": "Enter a valid phone number."},
      );
    }

    _otpRequestInFlight = true;
    try {
      await _apiClient.requestPhoneOtp(phone: normalized, purpose: purpose);
      logAuthEvent("Phone verification requested");
      return const AuthRequestResult(
        status: AuthRequestStatus.success,
        userMessage: "Verification code sent.",
      );
    } on AuthApiException catch (error) {
      return _mapAuthException(error);
    } on SocketException {
      return const AuthRequestResult(
        status: AuthRequestStatus.networkError,
        userMessage: "Unable to send a code right now. Try again shortly.",
      );
    } finally {
      _otpRequestInFlight = false;
    }
  }

  Future<AuthRequestResult> verifyPhoneOtp({
    required String phone,
    required String code,
    String purpose = "login",
  }) async {
    final otpError = validateOtpCode(code);
    if (otpError != null) {
      return AuthRequestResult(
        status: AuthRequestStatus.validationError,
        userMessage: otpError,
        fieldErrors: {"otp": otpError},
      );
    }

    final normalized = normalizePhoneNumber(phone);
    if (!isValidPhoneNumber(normalized)) {
      return const AuthRequestResult(
        status: AuthRequestStatus.validationError,
        userMessage: "Enter a valid phone number.",
        fieldErrors: {"identifier": "Enter a valid phone number."},
      );
    }

    try {
      final session = await _apiClient.verifyPhoneOtp(
          phone: normalized, code: code.trim(), purpose: purpose);
      await _sessionStore.save(session);
      final profileComplete = await _resolveProfileComplete(session);
      logAuthEvent("Phone verification succeeded");
      return AuthRequestResult(
        status: AuthRequestStatus.success,
        session: session,
        profileComplete: profileComplete,
      );
    } on AuthApiException catch (error) {
      return _mapOtpException(error);
    } on SocketException {
      return const AuthRequestResult(
        status: AuthRequestStatus.networkError,
        userMessage:
            "Unable to verify right now. Your code is still here — try again.",
      );
    }
  }

  Future<SessionRestoreResult> restorePersistedSession() async {
    final session = await _sessionStore.load();
    if (session == null || session.accessToken.isEmpty) {
      return const SessionRestoreResult(
          status: SessionRestoreStatus.unauthenticated);
    }

    try {
      final profile = await _fetchProfileWithRefresh(session);
      await _sessionStore.save(profile.session);
      if (!profile.citizenProfile.profileComplete) {
        return SessionRestoreResult(
          status: SessionRestoreStatus.profileIncomplete,
          session: profile.session,
        );
      }
      return SessionRestoreResult(
        status: SessionRestoreStatus.restored,
        session: profile.session,
      );
    } on SocketException {
      if (session.accessToken.isNotEmpty) {
        return SessionRestoreResult(
          status: SessionRestoreStatus.restored,
          session: session,
        );
      }
      return const SessionRestoreResult(status: SessionRestoreStatus.failed);
    } on http.ClientException {
      if (session.accessToken.isNotEmpty) {
        return SessionRestoreResult(
          status: SessionRestoreStatus.restored,
          session: session,
        );
      }
      return const SessionRestoreResult(status: SessionRestoreStatus.failed);
    } on TimeoutException {
      return SessionRestoreResult(
        status: SessionRestoreStatus.restored,
        session: session,
      );
    } on AuthApiException catch (error) {
      if (error.statusCode == 401) {
        await _sessionStore.clear();
        return const SessionRestoreResult(
          status: SessionRestoreStatus.unauthenticated,
        );
      }
      return SessionRestoreResult(
        status: SessionRestoreStatus.restored,
        session: session,
      );
    } catch (_) {
      // An unclassified startup failure is not proof that a valid refresh
      // session was revoked. Preserve it for the next authenticated retry.
      return SessionRestoreResult(
        status: SessionRestoreStatus.restored,
        session: session,
      );
    }
  }

  /// Refresh the access token when the API returns 401 mid-session.
  /// Returns the latest session, or null only when refresh itself fails.
  Future<AuthSession?> ensureFreshSession() async {
    final session = await _sessionStore.load();
    if (session == null || session.accessToken.isEmpty) return null;
    try {
      final profile = await _fetchProfileWithRefresh(session);
      await _sessionStore.save(profile.session);
      return profile.session;
    } on AuthApiException catch (error) {
      if (error.statusCode == 401) {
        await _sessionStore.clear();
        return null;
      }
      return session;
    } on SocketException {
      return session;
    } on http.ClientException {
      return session;
    } catch (_) {
      return session;
    }
  }

  /// Coalesces concurrent refresh requests into a single API call.
  Future<AuthSession?> refreshSessionSingleFlight() {
    final inFlight = _refreshInFlight;
    if (inFlight != null) {
      return inFlight;
    }

    final operation = _performSessionRefresh();
    _refreshInFlight = operation;
    return operation.whenComplete(() {
      if (identical(_refreshInFlight, operation)) {
        _refreshInFlight = null;
      }
    });
  }

  Future<AuthSession?> _performSessionRefresh() async {
    final session = await _sessionStore.load();
    if (session == null || session.refreshToken.isEmpty) return null;
    try {
      final refreshed =
          await _apiClient.refreshSession(refreshToken: session.refreshToken);
      await _sessionStore.save(refreshed);
      return refreshed;
    } on AuthApiException catch (error) {
      if (error.statusCode == 401) {
        await _sessionStore.clear();
        return null;
      }
      rethrow;
    }
  }

  /// Runs [action] with the current access token; refreshes once on 401 and retries.
  Future<T> withAuthorizedRetry<T>(
    Future<T> Function(String accessToken) action,
  ) async {
    final session = await _sessionStore.load();
    if (session == null || session.accessToken.isEmpty) {
      throw AuthApiException(401, "Not authenticated");
    }

    try {
      return await action(session.accessToken);
    } on AuthApiException catch (error) {
      if (error.statusCode != 401 || session.refreshToken.isEmpty) rethrow;
      final currentSession = await _sessionStore.load();
      if (currentSession != null &&
          currentSession.accessToken.isNotEmpty &&
          currentSession.accessToken != session.accessToken) {
        return action(currentSession.accessToken);
      }
      final refreshed = await refreshSessionSingleFlight();
      if (refreshed == null) rethrow;
      return action(refreshed.accessToken);
    }
  }

  Future<void> logout() async {
    final session = await _sessionStore.load();
    if (session != null && session.refreshToken.isNotEmpty) {
      try {
        await _apiClient.logout(refreshToken: session.refreshToken);
      } catch (_) {
        // Clear local session even when the API is unreachable.
      }
    }
    await _sessionStore.clear();
    logAuthEvent("Auth logout completed");
  }

  Future<({AuthSession session, CitizenProfile citizenProfile})>
      _fetchProfileWithRefresh(AuthSession session) async {
    try {
      final profile = await _apiClient.fetchCitizenProfile(
          accessToken: session.accessToken);
      await _languageRegionPreferenceStore?.saveFromProfile(profile);
      return (session: session, citizenProfile: profile);
    } on AuthApiException catch (error) {
      if (error.statusCode != 401 || session.refreshToken.isEmpty) rethrow;
      final currentSession = await _sessionStore.load();
      if (currentSession != null &&
          currentSession.accessToken.isNotEmpty &&
          currentSession.accessToken != session.accessToken) {
        final profile = await _apiClient.fetchCitizenProfile(
          accessToken: currentSession.accessToken,
        );
        await _languageRegionPreferenceStore?.saveFromProfile(profile);
        return (session: currentSession, citizenProfile: profile);
      }
      final refreshed = await refreshSessionSingleFlight();
      if (refreshed == null) rethrow;
      final profile = await _apiClient.fetchCitizenProfile(
          accessToken: refreshed.accessToken);
      await _languageRegionPreferenceStore?.saveFromProfile(profile);
      return (session: refreshed, citizenProfile: profile);
    }
  }

  Future<bool> _resolveProfileComplete(AuthSession session) async {
    try {
      final profile = await _fetchProfileWithRefresh(session);
      await _sessionStore.save(profile.session);
      return profile.citizenProfile.profileComplete;
    } catch (_) {
      return false;
    }
  }

  AuthRequestResult _mapRecoveryRequestException(AuthApiException error) {
    if (error.statusCode == 429) {
      return const AuthRequestResult(
        status: AuthRequestStatus.rateLimited,
        userMessage:
            "Too many attempts. Please wait a few minutes and try again.",
      );
    }
    if (error.statusCode == 503 ||
        (error.errorCode ?? "").startsWith("AUTH_DELIVERY") ||
        (error.errorCode ?? "").startsWith("AUTH-URL-")) {
      return const AuthRequestResult(
        status: AuthRequestStatus.serverError,
        userMessage:
            "We couldn’t send recovery instructions right now. Please try again.",
      );
    }
    return const AuthRequestResult(
      status: AuthRequestStatus.serverError,
      userMessage: "We couldn’t process your request right now.",
    );
  }

  AuthRequestResult _recoveryNetworkFailure() {
    return const AuthRequestResult(
      status: AuthRequestStatus.networkError,
      userMessage:
          "We couldn’t send recovery instructions right now. Please try again.",
    );
  }

  AuthRequestResult _recoveryUnexpectedFailure() {
    return const AuthRequestResult(
      status: AuthRequestStatus.serverError,
      userMessage: "We couldn’t process your request right now.",
    );
  }

  AuthRequestResult _mapAuthException(AuthApiException error) {
    final code = error.errorCode ?? "";
    if (code == "AUTH_DELIVERY_UNAVAILABLE" || code == "AUTH_DELIVERY_FAILED") {
      return const AuthRequestResult(
        status: AuthRequestStatus.serverError,
        userMessage:
            "We couldn’t send recovery instructions right now. Please try again.",
      );
    }
    if (error.statusCode == 401) {
      return const AuthRequestResult(
        status: AuthRequestStatus.invalidCredentials,
        userMessage: "Email, phone, or password is incorrect.",
      );
    }
    if (error.statusCode == 409) {
      return AuthRequestResult(
        status: AuthRequestStatus.emailAlreadyRegistered,
        userMessage: error.userMessage,
      );
    }
    if (error.statusCode == 429) {
      return const AuthRequestResult(
        status: AuthRequestStatus.rateLimited,
        userMessage:
            "Too many attempts. Please wait a few minutes and try again.",
      );
    }
    if (error.statusCode == 400) {
      return AuthRequestResult(
        status: AuthRequestStatus.validationError,
        userMessage: error.userMessage,
      );
    }
    return const AuthRequestResult(
      status: AuthRequestStatus.serverError,
      userMessage: "We couldn’t process your request right now.",
    );
  }

  AuthRequestResult _mapOtpException(AuthApiException error) {
    final message = error.userMessage.toLowerCase();
    if (message.contains("expired")) {
      return AuthRequestResult(
          status: AuthRequestStatus.otpExpired, userMessage: error.userMessage);
    }
    if (message.contains("already been used")) {
      return AuthRequestResult(
          status: AuthRequestStatus.otpAlreadyUsed,
          userMessage: error.userMessage);
    }
    if (message.contains("locked")) {
      return AuthRequestResult(
          status: AuthRequestStatus.otpLocked, userMessage: error.userMessage);
    }
    if (message.contains("invalid otp")) {
      return AuthRequestResult(
          status: AuthRequestStatus.otpInvalid, userMessage: error.userMessage);
    }
    if (message.contains("no active otp")) {
      return AuthRequestResult(
          status: AuthRequestStatus.otpMissing, userMessage: error.userMessage);
    }
    return _mapAuthException(error);
  }
}

class AuthApiException implements Exception {
  AuthApiException(
    this.statusCode,
    this.userMessage, {
    this.errorCode,
    this.tokenAud,
    this.expectedProjectId,
  });

  final int statusCode;
  final String userMessage;
  final String? errorCode;
  final String? tokenAud;
  final String? expectedProjectId;

  static AuthApiException fromResponse(http.Response response) {
    String message = "Unable to complete sign in right now.";
    String? code;
    String? tokenAud;
    String? expectedProjectId;
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map) {
        final raw = decoded["message"];
        if (raw is String && raw.trim().isNotEmpty) {
          message = raw;
        } else if (raw is Map) {
          if (raw["message"] is String) message = raw["message"] as String;
          if (raw["code"] is String) code = raw["code"] as String;
          if (raw["tokenAud"] is String) tokenAud = raw["tokenAud"] as String;
          if (raw["expectedProjectId"] is String) {
            expectedProjectId = raw["expectedProjectId"] as String;
          }
        }
        if (decoded["code"] is String) code = decoded["code"] as String;
      }
    } catch (_) {
      // Keep generic message.
    }
    if (response.statusCode == 429) {
      message = message.contains("OTP")
          ? message
          : "Too many attempts. Wait a minute and try again.";
    }
    return AuthApiException(
      response.statusCode,
      message,
      errorCode: code,
      tokenAud: tokenAud,
      expectedProjectId: expectedProjectId,
    );
  }
}
