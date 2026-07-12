import "dart:async";
import "dart:convert";
import "dart:io";

import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";

import "package:the_eye_mobile/auth/auth_service.dart";
import "package:the_eye_mobile/auth/auth_session_store.dart";
import "package:the_eye_mobile/auth/auth_validation.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/contracts/the_eye_api_paths.dart";

void main() {
  group("auth validation", () {
    test("normalizes Nigerian phone numbers before API use", () {
      expect(normalizePhoneNumber("08012345678"), "+2348012345678");
      expect(normalizePhoneNumber("+234 801 234 5678"), "+2348012345678");
    });

    test("validates email and password rules", () {
      final result =
          validateLoginForm(identifier: "bad-email", password: "short");
      expect(result["identifier"], isNotNull);
      expect(result["password"], contains("8 characters"));
    });

    test("validates OTP length and accepted characters", () {
      expect(validateOtpCode("12ab56"), isNotNull);
      expect(validateOtpCode("123456"), isNull);
      expect(sanitizeOtpInput("12-34-56"), "123456");
    });
  });

  group("AuthService", () {
    test("maps invalid credentials without leaking secrets", () async {
      final client = TheEyeApiClient(
        httpClient: MockClient((_) async =>
            http.Response(jsonEncode({"message": "Invalid credentials"}), 401)),
      );
      final service = AuthService(
          apiClient: client, sessionStore: InMemoryAuthSessionStore());
      final result = await service.login(
          identifier: "citizen@theeye.local", password: "Password123!");

      expect(result.status, AuthRequestStatus.invalidCredentials);
      expect(result.userMessage, isNot(contains("Password123")));
    });

    test("maps OTP rate-limit feedback", () async {
      final client = TheEyeApiClient(
        httpClient: MockClient((request) async {
          if (request.url.path.endsWith(TheEyeApiPaths.authRequestPhoneOtp)) {
            return http.Response(
                jsonEncode({
                  "message":
                      "Too many OTP requests. Wait a minute and try again."
                }),
                429);
          }
          return http.Response("{}", 404);
        }),
      );
      final service = AuthService(
          apiClient: client, sessionStore: InMemoryAuthSessionStore());
      final result = await service.requestPhoneOtp("08012345678");

      expect(result.status, AuthRequestStatus.rateLimited);
      expect(result.userMessage, contains("Too many"));
    });

    test("prevents multiple simultaneous OTP requests", () async {
      final completer = Completer<http.Response>();
      final client =
          TheEyeApiClient(httpClient: MockClient((_) => completer.future));
      final service = AuthService(
          apiClient: client, sessionStore: InMemoryAuthSessionStore());

      final first = service.requestPhoneOtp("08012345678");
      final second = await service.requestPhoneOtp("08012345678");
      completer.complete(http.Response(jsonEncode({"ok": true}), 200));

      expect(second.status, AuthRequestStatus.rateLimited);
      await first;
    });

    test("handles expired and locked OTP API errors", () async {
      final client = TheEyeApiClient(
        httpClient: MockClient((_) async => http.Response(
            jsonEncode({"message": "OTP expired. Request a new code."}), 400)),
      );
      final service = AuthService(
          apiClient: client, sessionStore: InMemoryAuthSessionStore());
      final expired =
          await service.verifyPhoneOtp(phone: "08012345678", code: "123456");
      expect(expired.status, AuthRequestStatus.otpExpired);

      final lockedClient = TheEyeApiClient(
        httpClient: MockClient((_) async => http.Response(
            jsonEncode({"message": "OTP locked due to too many attempts."}),
            400)),
      );
      final locked = await AuthService(
              apiClient: lockedClient, sessionStore: InMemoryAuthSessionStore())
          .verifyPhoneOtp(phone: "08012345678", code: "123456");
      expect(locked.status, AuthRequestStatus.otpLocked);
    });

    test("handles invalid, already-used, and missing OTP API errors", () async {
      final invalidClient = TheEyeApiClient(
        httpClient: MockClient((_) async =>
            http.Response(jsonEncode({"message": "Invalid OTP code."}), 400)),
      );
      final invalid = await AuthService(
              apiClient: invalidClient,
              sessionStore: InMemoryAuthSessionStore())
          .verifyPhoneOtp(phone: "08012345678", code: "123456");
      expect(invalid.status, AuthRequestStatus.otpInvalid);

      final usedClient = TheEyeApiClient(
        httpClient: MockClient((_) async => http.Response(
            jsonEncode({"message": "OTP has already been used."}), 400)),
      );
      final used = await AuthService(
              apiClient: usedClient, sessionStore: InMemoryAuthSessionStore())
          .verifyPhoneOtp(phone: "08012345678", code: "123456");
      expect(used.status, AuthRequestStatus.otpAlreadyUsed);

      final missingClient = TheEyeApiClient(
        httpClient: MockClient((_) async => http.Response(
            jsonEncode({"message": "No active OTP for this phone."}), 400)),
      );
      final missing = await AuthService(
              apiClient: missingClient,
              sessionStore: InMemoryAuthSessionStore())
          .verifyPhoneOtp(phone: "08012345678", code: "123456");
      expect(missing.status, AuthRequestStatus.otpMissing);
    });

    test("preserves form state during temporary network failure", () async {
      final client = TheEyeApiClient(
        httpClient:
            MockClient((_) async => throw const SocketException("offline")),
      );
      final service = AuthService(
          apiClient: client, sessionStore: InMemoryAuthSessionStore());
      final result = await service.login(
          identifier: "citizen@theeye.local", password: "Password123!");

      expect(result.status, AuthRequestStatus.networkError);
      expect(result.userMessage, contains("still here"));
    });

    test("successful login stores session tokens", () async {
      final store = InMemoryAuthSessionStore();
      final client = TheEyeApiClient(
        httpClient: MockClient((_) async => http.Response(
              jsonEncode({
                "accessToken": "access-token",
                "refreshToken": "refresh-token",
                "user": {"sub": "user-1"}
              }),
              200,
            )),
      );
      final service = AuthService(apiClient: client, sessionStore: store);
      final result = await service.login(
          identifier: "citizen@theeye.local", password: "Password123!");

      expect(result.isSuccess, isTrue);
      expect((await store.load())?.accessToken, "access-token");
    });
  });
}
