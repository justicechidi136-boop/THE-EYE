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
}

class AuthRequestResult {
  const AuthRequestResult({
    required this.status,
    this.session,
    this.userMessage,
    this.fieldErrors = const {},
  });

  final AuthRequestStatus status;
  final AuthSession? session;
  final String? userMessage;
  final Map<String, String> fieldErrors;

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

  AuthRequestResult _mapAuthException(AuthApiException error) {
    if (error.statusCode == 401) {
      return const AuthRequestResult(
        status: AuthRequestStatus.invalidCredentials,
        userMessage: "Email, phone, or password is incorrect.",
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
  AuthApiException(this.statusCode, this.userMessage, {this.errorCode});

  final int statusCode;
  final String userMessage;
  final String? errorCode;

  static AuthApiException fromResponse(http.Response response) {
    String message = "Unable to complete sign in right now.";
    String? code;
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map) {
        final raw = decoded["message"];
        if (raw is String && raw.trim().isNotEmpty) {
          message = raw;
        } else if (raw is Map) {
          if (raw["message"] is String) message = raw["message"] as String;
          if (raw["code"] is String) code = raw["code"] as String;
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
    return AuthApiException(response.statusCode, message, errorCode: code);
  }
}
