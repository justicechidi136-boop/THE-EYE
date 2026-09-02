import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/auth/citizen_auth_return_link.dart";
import "package:the_eye_mobile/auth/citizen_auth_return_listener.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<GlobalKey<NavigatorState>> pumpApp(WidgetTester tester) async {
    final navKey = GlobalKey<NavigatorState>();
    await tester.pumpWidget(
      MaterialApp(
        navigatorKey: navKey,
        home: const Scaffold(body: Text("home-root")),
        routes: {
          "/login": (context) {
            final args = ModalRoute.of(context)?.settings.arguments;
            final message = args is Map ? args["authReturnMessage"] : null;
            return Scaffold(
              body: Text(message is String ? message : "citizen-sign-in"),
            );
          },
          "/home": (_) => const Scaffold(body: Text("citizen-home")),
          "/broadcasts/broadcast-42": (_) =>
              const Scaffold(body: Text("broadcast-detail")),
        },
      ),
    );
    await tester.pump();
    return navKey;
  }

  testWidgets("cold-start return opens citizen sign-in with message",
      (tester) async {
    final navKey = await pumpApp(tester);
    navigateCitizenAuthReturn(
      nav: navKey.currentState!,
      message: "Password updated. Sign in with your new password.",
      isAuthenticated: false,
    );
    await tester.pumpAndSettle();
    expect(
      find.text("Password updated. Sign in with your new password."),
      findsOneWidget,
    );
  });

  testWidgets("background return replaces stack at citizen sign-in",
      (tester) async {
    final navKey = await pumpApp(tester);
    navKey.currentState!.pushNamed("/login");
    await tester.pumpAndSettle();
    navigateCitizenAuthReturn(
      nav: navKey.currentState!,
      message: "Account recovery confirmed. Continue sign-in in THE EYE.",
      isAuthenticated: false,
    );
    await tester.pumpAndSettle();
    expect(
      find.text("Account recovery confirmed. Continue sign-in in THE EYE."),
      findsOneWidget,
    );
    expect(find.text("home-root"), findsNothing);
  });

  testWidgets("foreground return while signed-in goes home", (tester) async {
    final navKey = await pumpApp(tester);
    navigateCitizenAuthReturn(
      nav: navKey.currentState!,
      message: "ignored",
      isAuthenticated: true,
    );
    await tester.pumpAndSettle();
    expect(find.text("citizen-home"), findsOneWidget);
  });

  test("listener handleUri ignores admin destinations", () {
    final calls = <String>[];
    final listener = CitizenAuthReturnListener(
      onReturnToSignIn: calls.add,
    );
    listener.handleUri(
      Uri.parse("https://staging-dashboard8jps.theeye.com.ng/login"),
    );
    expect(calls, isEmpty);
  });

  test("listener handleUri accepts staging citizen return", () {
    final calls = <String>[];
    final listener = CitizenAuthReturnListener(
      onReturnToSignIn: calls.add,
      expectedScheme: "theeye-staging",
    );
    final uri = CitizenAuthReturnLink.buildReturnUri(
      "PASSWORD_RESET_SUCCESS",
      forScheme: "theeye-staging",
    );
    listener.handleUri(uri);
    expect(calls, isNotEmpty);
    expect(calls.first, contains("Password updated"));
  });

  test("invalid mobile return route fails safely", () {
    expect(
      CitizenAuthReturnLink.resolveSignInMessage(
        Uri.parse("theeye://not-auth/login"),
        expectedScheme: "theeye",
      ),
      isNull,
    );
  });

  test("public staging Broadcast link resolves to in-app detail route", () {
    expect(
      broadcastRouteForPublicUri(
        Uri.parse(
          "https://staging-dashboard8jps.theeye.com.ng/share/broadcasts/broadcast-42",
        ),
      ),
      "/broadcasts/broadcast-42",
    );
  });

  test("public Broadcast link rejects unapproved hosts and malformed paths",
      () {
    expect(
      broadcastRouteForPublicUri(
        Uri.parse("https://example.com/share/broadcasts/broadcast-42"),
      ),
      isNull,
    );
    expect(
      broadcastRouteForPublicUri(
        Uri.parse(
          "https://dashboard.theeye.com.ng/admin/broadcasts/broadcast-42",
        ),
      ),
      isNull,
    );
  });

  testWidgets("authenticated Broadcast link opens detail in the warm app",
      (tester) async {
    final navKey = await pumpApp(tester);
    navigateBroadcastLink(
      nav: navKey.currentState!,
      route: "/broadcasts/broadcast-42",
      isAuthenticated: true,
    );
    await tester.pumpAndSettle();
    expect(find.text("broadcast-detail"), findsOneWidget);
  });

  testWidgets("unauthenticated Broadcast link preserves destination at sign in",
      (tester) async {
    final navKey = await pumpApp(tester);
    navigateBroadcastLink(
      nav: navKey.currentState!,
      route: "/broadcasts/broadcast-42",
      isAuthenticated: false,
    );
    await tester.pumpAndSettle();
    final settings = ModalRoute.of(
      tester.element(find.text("citizen-sign-in")),
    )!
        .settings;
    expect(
      (settings.arguments as Map)["postLoginRoute"],
      "/broadcasts/broadcast-42",
    );
  });
}
