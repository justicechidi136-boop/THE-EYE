import "dart:async";
import "dart:convert";

import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";

import "package:the_eye_mobile/auth/account_recovery_flow.dart";
import "package:the_eye_mobile/auth/auth_service.dart";
import "package:the_eye_mobile/auth/auth_session_store.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/main.dart";

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
      final result = await buildService(client)
          .requestPasswordReset("citizen@theeye.local");
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
      final result = await buildService(client)
          .requestPasswordReset("citizen@theeye.local");
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

    test("timeout maps to a retryable network error", () async {
      final client = MockClient((request) async {
        throw TimeoutException("request timed out");
      });

      final result = await buildService(client)
          .requestAccountRecovery("citizen@theeye.local");

      expect(result.status, AuthRequestStatus.networkError);
      expect(result.userMessage, contains("Please try again"));
      expect(result.userMessage, isNot(contains("timed out")));
    });

    test("HTTP client failure maps to a retryable network error", () async {
      final client = MockClient((request) async {
        throw http.ClientException("connection closed", request.url);
      });

      final result = await buildService(client)
          .requestPasswordReset("citizen@theeye.local");

      expect(result.status, AuthRequestStatus.networkError);
      expect(result.userMessage, contains("Please try again"));
      expect(result.userMessage, isNot(contains("connection closed")));
    });

    test("unexpected failure returns safe generic copy", () async {
      final client = MockClient((request) async {
        throw StateError("sensitive provider detail");
      });

      final result = await buildService(client)
          .requestAccountRecovery("citizen@theeye.local");

      expect(result.status, AuthRequestStatus.serverError);
      expect(result.userMessage, "We couldn’t process your request right now.");
      expect(result.userMessage, isNot(contains("provider")));
    });
  });

  group("AUTH-001 recovery request screen reliability", () {
    AuthService buildService(MockClient client) {
      return AuthService(
        apiClient: TheEyeApiClient(httpClient: client),
        sessionStore: InMemoryAuthSessionStore(),
      );
    }

    Future<void> pumpRecoveryScreen(
      WidgetTester tester,
      MockClient client,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: AccountRecoveryRequestScreen(
            authService: buildService(client),
          ),
        ),
      );
      await tester.enterText(
        find.byType(TextField),
        "citizen@theeye.local",
      );
    }

    testWidgets("duplicate taps create one request and success restores action",
        (tester) async {
      final response = Completer<http.Response>();
      var requests = 0;
      final client = MockClient((request) {
        requests += 1;
        return response.future;
      });
      await pumpRecoveryScreen(tester, client);

      final action = find.text("Send recovery instructions");
      await tester.tap(action);
      await tester.pump();
      await tester.tap(find.byType(FilledButton));
      await tester.pump();

      expect(requests, 1);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      response.complete(http.Response(jsonEncode({"ok": true}), 200));
      await tester.pumpAndSettle();

      expect(find.text("Send recovery instructions"), findsOneWidget);
      expect(
        find.text(
          "If an account matches that information, recovery instructions have been sent.",
        ),
        findsOneWidget,
      );
    });

    testWidgets("failure restores action, preserves email, and allows retry",
        (tester) async {
      var requests = 0;
      final client = MockClient((request) async {
        requests += 1;
        if (requests == 1) {
          throw TimeoutException("request timed out");
        }
        return http.Response(jsonEncode({"ok": true}), 200);
      });
      await pumpRecoveryScreen(tester, client);

      await tester.tap(find.text("Send recovery instructions"));
      await tester.pumpAndSettle();

      expect(find.text("Send recovery instructions"), findsOneWidget);
      expect(find.textContaining("Please try again"), findsOneWidget);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller?.text,
        "citizen@theeye.local",
      );

      await tester.tap(find.text("Send recovery instructions"));
      await tester.pumpAndSettle();

      expect(requests, 2);
      expect(
        find.text(
          "If an account matches that information, recovery instructions have been sent.",
        ),
        findsOneWidget,
      );
    });

    testWidgets("disposing during an in-flight request does not update state",
        (tester) async {
      final response = Completer<http.Response>();
      final client = MockClient((request) => response.future);
      await pumpRecoveryScreen(tester, client);

      await tester.tap(find.text("Send recovery instructions"));
      await tester.pump();
      await tester.pumpWidget(const MaterialApp(home: SizedBox.shrink()));
      response.complete(http.Response(jsonEncode({"ok": true}), 200));
      await tester.pump();

      expect(tester.takeException(), isNull);
    });
  });

  group("AUTH-001 forgot password screen reliability", () {
    AuthService buildService(MockClient client) {
      return AuthService(
        apiClient: TheEyeApiClient(httpClient: client),
        sessionStore: InMemoryAuthSessionStore(),
      );
    }

    Future<void> pumpLoginScreen(
      WidgetTester tester,
      MockClient client,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: LoginRegisterScreen(authService: buildService(client)),
        ),
      );
      await tester.enterText(
        find.byType(TextField).first,
        "citizen@theeye.local",
      );
    }

    testWidgets("initial action is idle", (tester) async {
      final client = MockClient(
        (request) async => http.Response(jsonEncode({"ok": true}), 200),
      );
      await pumpLoginScreen(tester, client);

      expect(find.text("Forgot password?"), findsOneWidget);
      expect(find.text("Sending…"), findsNothing);
    });

    testWidgets("duplicate taps create one request and success restores action",
        (tester) async {
      final response = Completer<http.Response>();
      var requests = 0;
      final client = MockClient((request) {
        requests += 1;
        return response.future;
      });
      await pumpLoginScreen(tester, client);

      await tester.tap(find.text("Forgot password?"));
      await tester.pump();
      expect(find.text("Sending…"), findsOneWidget);
      await tester.tap(find.widgetWithText(TextButton, "Sending…"));
      await tester.pump();
      expect(requests, 1);

      response.complete(http.Response(jsonEncode({"ok": true}), 200));
      await tester.pumpAndSettle();

      expect(find.text("Forgot password?"), findsOneWidget);
      expect(
        find.text(
          "If an account matches that email, password-reset instructions have been sent.",
        ),
        findsOneWidget,
      );
    });

    testWidgets("HTTP failure preserves email and allows retry",
        (tester) async {
      var requests = 0;
      final client = MockClient((request) async {
        requests += 1;
        if (requests == 1) {
          return http.Response(jsonEncode({"message": "internal"}), 500);
        }
        return http.Response(jsonEncode({"ok": true}), 200);
      });
      await pumpLoginScreen(tester, client);

      await tester.tap(find.text("Forgot password?"));
      await tester.pumpAndSettle();

      expect(find.text("Forgot password?"), findsOneWidget);
      expect(find.text("We couldn’t process your request right now."),
          findsOneWidget);
      expect(
        tester.widget<TextField>(find.byType(TextField).first).controller?.text,
        "citizen@theeye.local",
      );

      await tester.tap(find.text("Forgot password?"));
      await tester.pumpAndSettle();
      expect(requests, 2);
      expect(
          find.textContaining("password-reset instructions"), findsOneWidget);
    });

    testWidgets("timeout exits progress with retryable feedback",
        (tester) async {
      final client = MockClient((request) async {
        throw TimeoutException("request timed out");
      });
      await pumpLoginScreen(tester, client);

      await tester.tap(find.text("Forgot password?"));
      await tester.pumpAndSettle();

      expect(find.text("Forgot password?"), findsOneWidget);
      expect(find.text("Sending…"), findsNothing);
      expect(find.textContaining("Please try again"), findsOneWidget);
    });
  });
}
