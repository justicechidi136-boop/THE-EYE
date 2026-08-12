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
  _FakeBroadcastFeedService({
    this.detail,
    this.listMineItems = const [],
    this.listMineError,
  });

  final BroadcastFeedItem? detail;
  final List<BroadcastFeedItem> listMineItems;
  final Object? listMineError;
  int markReadCalls = 0;
  int listMineCalls = 0;

  @override
  Future<BroadcastFeedItem> getDetail({
    required String accessToken,
    required String broadcastId,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 20));
    final item = detail;
    if (item == null) {
      throw IncidentApiException(404, "Broadcast not found",
          apiCode: "NOT_FOUND");
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

  @override
  Future<List<BroadcastFeedItem>> listMine({
    required String accessToken,
    String? status,
  }) async {
    listMineCalls += 1;
    await Future<void>.delayed(const Duration(milliseconds: 20));
    if (listMineError != null) {
      throw listMineError!;
    }
    return listMineItems;
  }
}

class _FakeBroadcastSession extends ChangeNotifier implements BroadcastSession {
  _FakeBroadcastSession({
    this.authenticated = true,
    BroadcastFeedItem? detail,
    List<BroadcastFeedItem> mineItems = const [],
    Object? listMineError,
    BroadcastSubmissionService? submissionService,
  }) : broadcastFeedService = _FakeBroadcastFeedService(
          detail: detail,
          listMineItems: mineItems,
          listMineError: listMineError,
        ),
        broadcastSubmissionService = submissionService ?? BroadcastSubmissionService();

  final bool authenticated;

  @override
  bool get isAuthenticated => authenticated;

  @override
  String? get accessToken => authenticated ? "test-token" : null;

  @override
  bool get lowDataMode => false;

  @override
  bool get online => true;

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
  final BroadcastSubmissionService broadcastSubmissionService;

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

class _FakeBroadcastSubmissionService extends BroadcastSubmissionService {
  _FakeBroadcastSubmissionService({this.onSubmit});

  int submitCalls = 0;
  final Future<void> Function(Map<String, dynamic> payload)? onSubmit;

  @override
  Future<SightingSubmissionResult> submitSighting({
    required String accessToken,
    required String broadcastId,
    required String clientActionId,
    required String description,
    required String locationMode,
    String? observedAt,
    double? latitude,
    double? longitude,
    String? approximateArea,
    String? confidence,
    bool anonymousToReviewers = false,
    String? directionOfTravel,
    List<Map<String, String>> attachments = const [],
  }) async {
    submitCalls += 1;
    await onSubmit?.call({
      "broadcastId": broadcastId,
      "clientActionId": clientActionId,
      "description": description,
      "locationMode": locationMode,
      "attachmentsCount": attachments.length,
    });
    return const SightingSubmissionResult(id: "s-1");
  }
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

    expect(find.text("Create Broadcast"), findsOneWidget);
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

  testWidgets("FUNC-023 My broadcasts loads empty state after first frame",
      (tester) async {
    final session = _FakeBroadcastSession(mineItems: const []);
    await tester.pumpWidget(
      wrap(
        const MyBroadcastsScreen(),
        session: session,
      ),
    );

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pump(); // post-frame callback
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(
        find.text("You haven't created any broadcasts yet."), findsOneWidget);
    expect(find.text("Create Broadcast"), findsOneWidget);
    expect(session.broadcastFeedService.listMineCalls, greaterThanOrEqualTo(1));
  });

  testWidgets("FUNC-023 My broadcasts shows canonical retry error",
      (tester) async {
    final session = _FakeBroadcastSession(
      listMineError: IncidentApiException(500, "backend down"),
    );
    await tester.pumpWidget(
      wrap(
        const MyBroadcastsScreen(),
        session: session,
      ),
    );

    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text("We couldn't load your broadcasts."), findsWidgets);
    expect(find.text("Retry"), findsOneWidget);
  });

  testWidgets("FUNC-023 auth redirect does not leave indefinite spinner",
      (tester) async {
    await tester.pumpWidget(
      wrap(
        const MyBroadcastsScreen(),
        authenticated: false,
      ),
    );

    await tester.pump();
    await tester.pumpAndSettle();
    expect(find.text("Login"), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets("FUNC-024 stolen vehicle detail renders structured hierarchy",
      (tester) async {
    final detail = BroadcastFeedItem(
      id: "b-vehicle-1",
      type: "StolenVehicle",
      title: "Stolen vehicle alert",
      body: "Fallback body",
      priority: "P2Urgent",
      read: false,
      publishedAt: DateTime.utc(2026, 8, 1, 13, 15),
      status: "Active",
      metadata: const {
        "make": "Toyota",
        "model": "Corolla",
        "year": "2022",
        "colour": "Red",
        "registrationNumber": "ABC-123XY",
        "vin": "JT2BG22K8V0123456",
        "stolenAt": "2026-08-01T13:10:00.000Z",
        "lastKnownLocation": "Ikeja under bridge",
        "theftDescription": "Taken from parking lot",
        "attachments": [
          {
            "mediaType": "image",
            "label": "Photo 1",
            "url": "https://example.com/car.jpg",
          }
        ],
      },
    );
    await tester.pumpWidget(
      wrap(
        const BroadcastDetailScreen(broadcastId: "b-vehicle-1"),
        detail: detail,
      ),
    );

    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.text("STOLEN VEHICLE"), findsOneWidget);
    expect(find.text("Toyota Corolla"), findsOneWidget);
    expect(find.text("Year"), findsOneWidget);
    expect(find.text("2022"), findsOneWidget);
    expect(find.text("Plate"), findsOneWidget);
    expect(find.text("ABC-123XY"), findsOneWidget);
    expect(find.text("VIN"), findsOneWidget);
    expect(find.text("JT2BG22K8V0123456"), findsOneWidget);
    expect(find.text("Last seen"), findsOneWidget);
    expect(find.textContaining("PM"), findsWidgets);
    expect(find.text("Theft description"), findsOneWidget);
    expect(find.text("Taken from parking lot"), findsOneWidget);
    expect(find.text("Evidence"), findsOneWidget);
    expect(find.text("Photo 1"), findsOneWidget);
  });

  testWidgets("report sighting button only shows for live stolen vehicle",
      (tester) async {
    final stolen = BroadcastFeedItem(
      id: "b-stolen",
      type: "StolenVehicle",
      title: "Stolen vehicle alert",
      body: "body",
      priority: "P2Urgent",
      read: false,
      publishedAt: DateTime.utc(2026, 8, 1),
      status: "Active",
    );
    await tester.pumpWidget(
      wrap(
        const BroadcastDetailScreen(broadcastId: "b-stolen"),
        detail: stolen,
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.text("Report sighting"), findsOneWidget);

    final missing = BroadcastFeedItem(
      id: "b-missing",
      type: "MissingPerson",
      title: "Missing person alert",
      body: "body",
      priority: "P2Urgent",
      read: false,
      publishedAt: DateTime.utc(2026, 8, 1),
      status: "Active",
    );
    await tester.pumpWidget(
      wrap(
        const BroadcastDetailScreen(broadcastId: "b-missing"),
        detail: missing,
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.text("Report sighting"), findsNothing);
  });

  testWidgets("submit sighting flow shows location modes and success replacement",
      (tester) async {
    final submitService = _FakeBroadcastSubmissionService();
    final detail = BroadcastFeedItem(
      id: "b1",
      type: "StolenVehicle",
      title: "Stolen vehicle alert",
      body: "body",
      priority: "P2Urgent",
      read: false,
      publishedAt: DateTime.utc(2026, 8, 1),
      status: "Active",
      metadata: const {"make": "Toyota", "model": "Corolla"},
    );
    final session = _FakeBroadcastSession(
      detail: detail,
      submissionService: submitService,
    );
    await tester.pumpWidget(
      wrap(
        const SubmitSightingScreen(broadcastId: "b1"),
        session: session,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("Use current location"), findsOneWidget);
    expect(find.text("Enter manually"), findsOneWidget);
    expect(find.text("Skip"), findsOneWidget);
    expect(find.text("EVIDENCE"), findsOneWidget);

    await tester.enterText(
      find.widgetWithText(TextField, "What did you observe?"),
      "Seen heading east",
    );
    await tester.tap(find.text("Submit sighting"));
    await tester.pumpAndSettle();

    expect(find.text("Sighting submitted"), findsOneWidget);
    expect(submitService.submitCalls, 1);

    await tester.tap(find.text("Back to broadcast"));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));
    expect(find.text("Broadcast Detail"), findsOneWidget);
  });
}
