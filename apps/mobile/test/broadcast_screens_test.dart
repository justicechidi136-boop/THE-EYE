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

class _FakeBroadcastFeedService extends BroadcastFeedService {
  _FakeBroadcastFeedService({this.detail});

  final BroadcastFeedItem? detail;
  int markReadCalls = 0;

  @override
  Future<BroadcastFeedItem> getDetail({
    required String accessToken,
    required String broadcastId,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 20));
    final item = detail;
    if (item == null) {
      throw IncidentApiException(404, "Broadcast not found", apiCode: "NOT_FOUND");
    }
    return item;
  }

  @override
  Future<void> markRead({
    required String accessToken,
    required String broadcastId,
  }) async {
    markReadCalls += 1;
  }
}

class _FakeBroadcastSession extends ChangeNotifier implements BroadcastSession {
  _FakeBroadcastSession({
    this.authenticated = true,
    BroadcastFeedItem? detail,
  }) : broadcastFeedService = _FakeBroadcastFeedService(detail: detail);

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
  final _FakeBroadcastFeedService broadcastFeedService;

  @override
  final BroadcastSubmissionService broadcastSubmissionService =
      BroadcastSubmissionService();

  @override
  Future<void> markBroadcastRead(String broadcastId) async {
    await broadcastFeedService.markRead(
      accessToken: accessToken ?? "",
      broadcastId: broadcastId,
    );
  }

  @override
  Future<void> loadBroadcastsFromApi({bool refresh = false}) async {}
}

void main() {
  Widget wrap(
    Widget child, {
    bool authenticated = true,
    BroadcastFeedItem? detail,
    _FakeBroadcastSession? session,
  }) {
    return MaterialApp(
      theme: ThemeData(
        brightness: Brightness.dark,
        extensions: const [EyeSemanticColors.dark],
      ),
      home: AppScope(
        controller: session ??
            _FakeBroadcastSession(
              authenticated: authenticated,
              detail: detail,
            ),
        child: child,
      ),
      routes: {
        BroadcastRoutes.create: (_) => const BroadcastCreateHubScreen(),
        BroadcastRoutes.mine: (_) => const MyBroadcastsScreen(),
        "/login": (_) => const Scaffold(body: Text("Login")),
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

  testWidgets("FUNC-011 detail leaves spinner and shows content",
      (tester) async {
    final detail = BroadcastFeedItem(
      id: "b-detail-1",
      type: "MissingPerson",
      title: "Missing person: Ada",
      body: "Last seen near the market",
      priority: "P2Urgent",
      read: false,
      publishedAt: DateTime.utc(2026, 8, 1),
      status: "Active",
      creatorUserId: "user-1",
    );
    await tester.pumpWidget(
      wrap(
        const BroadcastDetailScreen(broadcastId: "b-detail-1"),
        detail: detail,
      ),
    );
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pump(); // post-frame callback
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text("Missing person: Ada"), findsWidgets);
    expect(find.text("Broadcast unavailable"), findsNothing);
  });

  testWidgets("FUNC-011 detail shows retry when API fails", (tester) async {
    await tester.pumpWidget(
      wrap(const BroadcastDetailScreen(broadcastId: "missing")),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text("Broadcast unavailable"), findsOneWidget);
    expect(find.text("This broadcast is no longer available."), findsOneWidget);
    expect(find.text("Retry"), findsOneWidget);
  });
}
