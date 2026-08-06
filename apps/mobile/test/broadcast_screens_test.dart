import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/broadcasts/broadcast_feed_service.dart";
import "package:the_eye_mobile/broadcasts/broadcast_navigation.dart";
import "package:the_eye_mobile/broadcasts/broadcast_public_share.dart";
import "package:the_eye_mobile/broadcasts/broadcast_screens.dart";
import "package:the_eye_mobile/broadcasts/broadcast_session.dart";
import "package:the_eye_mobile/broadcasts/broadcast_submission_service.dart";
import "package:the_eye_mobile/app/app_scope.dart";
import "package:the_eye_mobile/app/session_accessor.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/brand.dart";
import "package:the_eye_mobile/design_system/eye_semantic_colors.dart";

class _FakeBroadcastSession extends ChangeNotifier implements BroadcastSession {
  _FakeBroadcastSession({this.authenticated = true});

  final bool authenticated;

  @override
  bool get isAuthenticated => authenticated;

  @override
  String? get accessToken => authenticated ? "test-token" : null;

  @override
  bool get lowDataMode => false;

  @override
  bool get isEmergencyLocationTracking => false;

  @override
  Future<void> clearSession() async {}

  @override
  CitizenProfile? get cachedCitizenProfile => null;

  @override
  Future<CitizenProfile?> loadCitizenProfile(
          {bool forceRefresh = false}) async =>
      null;

  @override
  void clearCitizenProfileCache() {}

  @override
  Future<CitizenProfile> updateCitizenProfile(
    Map<String, Object?> payload,
  ) async =>
      throw UnimplementedError();

  @override
  final BroadcastFeedService broadcastFeedService = BroadcastFeedService();

  @override
  final BroadcastSubmissionService broadcastSubmissionService =
      BroadcastSubmissionService();

  @override
  Future<void> markBroadcastRead(String broadcastId) async {}

  @override
  Future<void> loadBroadcastsFromApi({bool refresh = false}) async {}
}

void main() {
  Widget wrap(Widget child, {bool authenticated = true}) {
    return MaterialApp(
      theme: ThemeData(
        brightness: Brightness.dark,
        extensions: const [EyeSemanticColors.dark],
      ),
      home: AppScope(
        controller: _FakeBroadcastSession(authenticated: authenticated),
        child: child,
      ),
      routes: {
        BroadcastRoutes.create: (_) => const BroadcastCreateHubScreen(),
        BroadcastRoutes.mine: (_) => const MyBroadcastsScreen(),
      },
      onGenerateRoute: (settings) => resolveBroadcastRoute(settings),
    );
  }

  test("ParsedBroadcastRoute resolves detail and sub-routes", () {
    expect(
      ParsedBroadcastRoute.parse("/broadcasts/b1")?.kind,
      BroadcastRouteKind.detail,
    );
    expect(
      ParsedBroadcastRoute.parse("/broadcasts/b1/comments")?.kind,
      BroadcastRouteKind.comments,
    );
    expect(
      ParsedBroadcastRoute.parse("/broadcasts/create")?.kind,
      BroadcastRouteKind.createHub,
    );
    expect(
      ParsedBroadcastRoute.parse("/broadcasts/mine")?.kind,
      BroadcastRouteKind.mine,
    );
    expect(ParsedBroadcastRoute.parse("/broadcasts/create/extra"), isNull);
  });

  test("broadcastDetailRoute builds safe detail path", () {
    expect(broadcastDetailRoute("abc"), "/broadcasts/abc");
    expect(broadcastDetailRoute(""), isNull);
  });

  testWidgets("BroadcastCreateHubScreen renders create options",
      (tester) async {
    await tester.pumpWidget(wrap(const BroadcastCreateHubScreen()));
    await tester.pumpAndSettle();

    expect(find.text("Create broadcast"), findsOneWidget);
    expect(find.text("Missing person"), findsOneWidget);
    expect(find.text("Stolen vehicle"), findsOneWidget);
    expect(find.text("My broadcasts"), findsOneWidget);
  });

  testWidgets("BroadcastReportScreen renders report reasons", (tester) async {
    await tester.pumpWidget(
      wrap(const BroadcastReportScreen(broadcastId: "b1")),
    );
    await tester.pumpAndSettle();

    expect(find.text("Report broadcast"), findsOneWidget);
    expect(find.text("False or misleading"), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text("Submit report"),
      120,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text("Submit report"), findsOneWidget);
  });

  test("BroadcastSharePayload builds public-safe share text", () {
    final payload = BroadcastSharePayload.fromPublic(
      BroadcastPublicSharePayload.fromApiJson({
        "data": {
          "id": "b1",
          "type": "MissingPerson",
          "status": "Active",
          "title": "Missing person: Ada",
          "summary": "Missing person alert: Ada, approx. age 10.",
          "deepLink": "/broadcasts/b1",
        },
      }),
    );
    expect(payload.title, "Missing person: Ada");
    expect(payload.shareText, contains("Missing person: Ada"));
    expect(payload.shareText, contains("/broadcasts/b1"));
    expect(payload.locallyGenerated, isFalse);
  });

  test("BroadcastCommentItem parses sighting metadata", () {
    final comment = BroadcastCommentItem.fromJson({
      "id": "c1",
      "body": "Seen near the market.",
      "createdAt": "2026-08-06T10:00:00.000Z",
      "metadata": {"isSighting": true},
    });
    expect(comment.isSighting, isTrue);
    expect(comment.body, "Seen near the market.");
  });
}
