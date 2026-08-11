import "dart:convert";

import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";

import "package:the_eye_mobile/auth/auth_service.dart";
import "package:the_eye_mobile/auth/auth_session_store.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";

void main() {
  group("AUTH-005 / AUTH-006 recovery request confirmation", () {
    AuthService buildService(MockClient client) {
      return AuthService(
        apiClient: TheEyeApiClient(httpClient: client),
        sessionStore: InMemoryAuthSessionStore(),
      );
    }

    test("forgot password success uses anti-enumeration confirmation copy",
        () async {
      final client = MockClient((request) async {
        expect(request.url.path, endsWith("/auth/password-reset/request"));
        return http.Response(jsonEncode({"ok": true}), 200);
      });
      final result =
          await buildService(client).requestPasswordReset("citizen@theeye.local");
      expect(result.isSuccess, isTrue);
      expect(
        result.userMessage,
        "If an account matches that email, password-reset instructions have been sent.",
      );
    });

    test("account recovery success uses anti-enumeration confirmation copy",
        () async {
      final client = MockClient((request) async {
        expect(request.url.path, endsWith("/auth/account-recovery/request"));
        return http.Response(jsonEncode({"ok": true}), 200);
      });
      final result = await buildService(client)
          .requestAccountRecovery("citizen@theeye.local");
      expect(result.isSuccess, isTrue);
      expect(
        result.userMessage,
        "If an account matches that information, recovery instructions have been sent.",
      );
    });

    test("delivery failure maps to friendly recovery message", () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({
            "message": "SMTP boom",
            "code": "AUTH_DELIVERY_FAILED",
          }),
          503,
        );
      });
      final result =
          await buildService(client).requestPasswordReset("citizen@theeye.local");
      expect(result.isSuccess, isFalse);
      expect(
        result.userMessage,
        "We couldn’t send recovery instructions right now. Please try again.",
      );
      expect(result.userMessage, isNot(contains("SMTP")));
      expect(result.userMessage, isNot(contains("AUTH_DELIVERY")));
    });

    test("rate limit maps to friendly wait message", () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({"message": "Too many requests"}),
          429,
        );
      });
      final result = await buildService(client)
          .requestAccountRecovery("citizen@theeye.local");
      expect(result.status, AuthRequestStatus.rateLimited);
      expect(
        result.userMessage,
        "Too many attempts. Please wait a few minutes and try again.",
      );
    });
  });
}
