import "dart:convert";
import "dart:io";

import "package:http/http.dart" as http;

import "../contracts/the_eye_api_client.dart";
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
  })  : _apiClient = apiClient,
        _sessionStore = sessionStore;

  final TheEyeApiClient _apiClient;
  final AuthSessionStore _sessionStore;
  bool _otpRequestInFlight = false;

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
      logAuthEvent("Auth login succeeded for ${parsed.kind.name} identifier");
      return AuthRequestResult(
          status: AuthRequestStatus.success, session: session);
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
      logAuthEvent("Password reset requested");
      return const AuthRequestResult(
        status: AuthRequestStatus.success,
        userMessage: "If that email exists, reset instructions were sent.",
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
      logAuthEvent("Phone verification succeeded");
      return AuthRequestResult(
          status: AuthRequestStatus.success, session: session);
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
    } catch (_) {
      await _sessionStore.clear();
      return const SessionRestoreResult(status: SessionRestoreStatus.failed);
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
      return (session: session, citizenProfile: profile);
    } on AuthApiException catch (error) {
      if (error.statusCode != 401 || session.refreshToken.isEmpty) rethrow;
      final refreshed =
          await _apiClient.refreshSession(refreshToken: session.refreshToken);
      final profile = await _apiClient.fetchCitizenProfile(
          accessToken: refreshed.accessToken);
      return (session: refreshed, citizenProfile: profile);
    }
  }

  AuthRequestResult _mapAuthException(AuthApiException error) {
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
      return AuthRequestResult(
        status: AuthRequestStatus.rateLimited,
        userMessage: error.userMessage,
      );
    }
    if (error.statusCode == 400) {
      return AuthRequestResult(
        status: AuthRequestStatus.validationError,
        userMessage: error.userMessage,
      );
    }
    return AuthRequestResult(
      status: AuthRequestStatus.serverError,
      userMessage: error.userMessage,
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
