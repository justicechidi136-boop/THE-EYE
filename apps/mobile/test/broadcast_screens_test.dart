import "dart:async";

import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/broadcasts/broadcast_feed_service.dart";
import "package:the_eye_mobile/broadcasts/broadcast_navigation.dart";
import "package:the_eye_mobile/broadcasts/broadcast_public_share.dart";
import "package:the_eye_mobile/broadcasts/broadcast_screens.dart";
import "package:the_eye_mobile/broadcasts/broadcast_session.dart";
import "package:the_eye_mobile/broadcasts/broadcast_submission_service.dart";
import "package:the_eye_mobile/app/app_scope.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
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
  })  : broadcastFeedService = _FakeBroadcastFeedService(
          detail: detail,
          listMineItems: mineItems,
          listMineError: listMineError,
        ),
        broadcastSubmissionService =
            submissionService ?? BroadcastSubmissionService();

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
  _FakeBroadcastSubmissionService({
    this.onSubmit,
    this.onReport,
  });

  int submitCalls = 0;
  int reportCalls = 0;
  final Future<void> Function(Map<String, dynamic> payload)? onSubmit;
  final Future<void> Function(Map<String, dynamic> payload)? onReport;

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
    List<Map<String, Object?>> attachments = const [],
  }) async {
    submitCalls += 1;
    await onSubmit?.call({
      "broadcastId": broadcastId,
      "clientActionId": clientActionId,
      "description": description,
      "locationMode": locationMode,
      "latitude": latitude,
      "longitude": longitude,
      "attachmentsCount": attachments.length,
    });
    return const SightingSubmissionResult(id: "s-1");
  }

  @override
  Future<void> report({
    required String accessToken,
    required String broadcastId,
    required String reason,
    String? details,
  }) async {
    reportCalls += 1;
    await onReport?.call({
      "broadcastId": broadcastId,
      "reason": reason,
      "details": details,
    });
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

  Future<void> scrollToReportControl(
    WidgetTester tester,
    Finder finder,
  ) async {
    await tester.scrollUntilVisible(
      finder,
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(finder, findsOneWidget);
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

  testWidgets("stolen vehicle report screen shows report broadcast reasons",
      (tester) async {
    await tester.pumpWidget(
      wrap(
        BroadcastReportScreen(
          broadcastId: "b1",
          source: BroadcastFeedItem(
            id: "b1",
            type: "StolenVehicle",
            title: "Stolen vehicle alert",
            body: "body",
            priority: "P2Urgent",
            read: false,
            publishedAt: DateTime.utc(2026, 8, 1),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("Report Broadcast"), findsOneWidget);
    expect(find.text("False or misleading"), findsOneWidget);
    expect(find.text("Vehicle information is incorrect"), findsOneWidget);
    expect(find.text("Vehicle already recovered"), findsOneWidget);
    expect(find.text("Person information is incorrect"), findsNothing);
    expect(find.text("Person already found"), findsNothing);
    await tester.scrollUntilVisible(
      find.text("Submit report"),
      120,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text("Submit report"), findsOneWidget);
  });

  testWidgets("missing person report screen shows report broadcast reasons",
      (tester) async {
    await tester.pumpWidget(
      wrap(
        BroadcastReportScreen(
          broadcastId: "b1",
          source: BroadcastFeedItem(
            id: "b1",
            type: "MissingPerson",
            title: "Missing person alert",
            body: "body",
            priority: "P2Urgent",
            read: false,
            publishedAt: DateTime.utc(2026, 8, 1),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text("Why are you reporting this missing person broadcast?"),
      findsOneWidget,
    );
    expect(find.text("Person information is incorrect"), findsOneWidget);
    expect(find.text("Person already found"), findsOneWidget);
    expect(find.text("Vehicle information is incorrect"), findsNothing);
    expect(find.text("Vehicle already recovered"), findsNothing);
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

  testWidgets("broadcast detail uses report broadcast label for moderation",
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

    expect(find.text("Report Broadcast"), findsOneWidget);
    expect(find.text("Report"), findsNothing);
    expect(find.text("Report sighting"), findsOneWidget);
  });

  testWidgets("broadcast detail groups available action buttons",
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

    expect(find.text("Actions"), findsOneWidget);
    expect(find.text("Share"), findsOneWidget);
    expect(find.text("Report sighting"), findsOneWidget);
    expect(find.text("Comments"), findsOneWidget);
    expect(find.text("Report Broadcast"), findsOneWidget);
  });

  testWidgets("selecting other reveals additional details", (tester) async {
    await tester.pumpWidget(
      wrap(
        BroadcastReportScreen(
          broadcastId: "b1",
          source: BroadcastFeedItem(
            id: "b1",
            type: "MissingPerson",
            title: "Missing person alert",
            body: "body",
            priority: "P2Urgent",
            read: false,
            publishedAt: DateTime.utc(2026, 8, 1),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("Additional details"), findsNothing);
    final otherFinder = find.text("Other");
    await scrollToReportControl(tester, otherFinder);
    await tester.tap(otherFinder);
    await tester.pumpAndSettle();
    expect(find.text("Additional details"), findsOneWidget);

    final duplicateFinder = find.text("Duplicate");
    await scrollToReportControl(tester, duplicateFinder);
    await tester.tap(duplicateFinder);
    await tester.pumpAndSettle();
    expect(find.text("Additional details"), findsNothing);
  });

  testWidgets("other reason requires non-empty additional details",
      (tester) async {
    final submissionService = _FakeBroadcastSubmissionService();
    final session = _FakeBroadcastSession(submissionService: submissionService);
    await tester.pumpWidget(
      wrap(
        BroadcastReportScreen(
          broadcastId: "b1",
          source: BroadcastFeedItem(
            id: "b1",
            type: "StolenVehicle",
            title: "Stolen vehicle alert",
            body: "body",
            priority: "P2Urgent",
            read: false,
            publishedAt: DateTime.utc(2026, 8, 1),
          ),
        ),
        session: session,
      ),
    );
    await tester.pumpAndSettle();

    final otherFinder = find.text("Other");
    await scrollToReportControl(tester, otherFinder);
    await tester.tap(otherFinder);
    await tester.pumpAndSettle();
    final submitFinder = find.widgetWithText(FilledButton, "Submit report");
    await scrollToReportControl(tester, submitFinder);
    await tester.tap(submitFinder);
    await tester.pumpAndSettle();

    expect(find.text("Additional details are required."), findsOneWidget);
    expect(submissionService.reportCalls, 0);
  });

  testWidgets("stolen vehicle report submission sends stable reason",
      (tester) async {
    Map<String, dynamic>? payload;
    final submissionService = _FakeBroadcastSubmissionService(
      onReport: (value) async => payload = value,
    );
    final session = _FakeBroadcastSession(submissionService: submissionService);
    await tester.pumpWidget(
      wrap(
        BroadcastReportScreen(
          broadcastId: "b-stolen",
          source: BroadcastFeedItem(
            id: "b-stolen",
            type: "StolenVehicle",
            title: "Stolen vehicle alert",
            body: "body",
            priority: "P2Urgent",
            read: false,
            publishedAt: DateTime.utc(2026, 8, 1),
          ),
        ),
        session: session,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text("Vehicle information is incorrect"));
    await tester.pumpAndSettle();
    final submitFinder = find.widgetWithText(FilledButton, "Submit report");
    await scrollToReportControl(tester, submitFinder);
    await tester.tap(submitFinder);
    await tester.pumpAndSettle();

    expect(payload?["broadcastId"], "b-stolen");
    expect(payload?["reason"], "VehicleInformationIncorrect");
    expect(payload?["details"], isNull);
  });

  testWidgets("missing person report submission sends stable reason",
      (tester) async {
    Map<String, dynamic>? payload;
    final submissionService = _FakeBroadcastSubmissionService(
      onReport: (value) async => payload = value,
    );
    final session = _FakeBroadcastSession(submissionService: submissionService);
    await tester.pumpWidget(
      wrap(
        BroadcastReportScreen(
          broadcastId: "b-missing",
          source: BroadcastFeedItem(
            id: "b-missing",
            type: "MissingPerson",
            title: "Missing person alert",
            body: "body",
            priority: "P2Urgent",
            read: false,
            publishedAt: DateTime.utc(2026, 8, 1),
          ),
        ),
        session: session,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text("Person already found"));
    await tester.pumpAndSettle();
    final submitFinder = find.widgetWithText(FilledButton, "Submit report");
    await scrollToReportControl(tester, submitFinder);
    await tester.tap(submitFinder);
    await tester.pumpAndSettle();

    expect(payload?["broadcastId"], "b-missing");
    expect(payload?["reason"], "PersonAlreadyFound");
    expect(payload?["details"], isNull);
  });

  testWidgets("report submission failure exits loading state", (tester) async {
    final submissionService = _FakeBroadcastSubmissionService(
      onReport: (_) async {
        throw IncidentApiException(500, "Please try again.");
      },
    );
    final session = _FakeBroadcastSession(submissionService: submissionService);
    await tester.pumpWidget(
      wrap(
        BroadcastReportScreen(
          broadcastId: "b1",
          source: BroadcastFeedItem(
            id: "b1",
            type: "MissingPerson",
            title: "Missing person alert",
            body: "body",
            priority: "P2Urgent",
            read: false,
            publishedAt: DateTime.utc(2026, 8, 1),
          ),
        ),
        session: session,
      ),
    );
    await tester.pumpAndSettle();

    final submitFinder = find.widgetWithText(FilledButton, "Submit report");
    await scrollToReportControl(tester, submitFinder);
    await tester.tap(submitFinder);
    await tester.pump();
    await tester.pumpAndSettle();

    expect(find.text("Please try again."), findsOneWidget);
    expect(find.text("Submit report"), findsOneWidget);
  });

  testWidgets("report submit button guards rapid repeat taps", (tester) async {
    final completer = Completer<void>();
    final submissionService = _FakeBroadcastSubmissionService(
      onReport: (_) => completer.future,
    );
    final session = _FakeBroadcastSession(submissionService: submissionService);
    await tester.pumpWidget(
      wrap(
        BroadcastReportScreen(
          broadcastId: "b1",
          source: BroadcastFeedItem(
            id: "b1",
            type: "StolenVehicle",
            title: "Stolen vehicle alert",
            body: "body",
            priority: "P2Urgent",
            read: false,
            publishedAt: DateTime.utc(2026, 8, 1),
          ),
        ),
        session: session,
      ),
    );
    await tester.pumpAndSettle();

    final submitFinder = find.widgetWithText(FilledButton, "Submit report");
    await scrollToReportControl(tester, submitFinder);
    await tester.tap(submitFinder);
    await tester.tap(submitFinder);
    await tester.pump();

    expect(submissionService.reportCalls, 1);
    completer.complete();
    await tester.pumpAndSettle();
  });

  testWidgets(
      "submit sighting flow shows location modes and success replacement",
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
    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(find.text("EVIDENCE"), 400,
        scrollable: scrollable);
    expect(find.text("EVIDENCE"), findsOneWidget);

    final descriptionField = find.byWidgetPredicate(
      (widget) =>
          widget is TextField &&
          widget.decoration is InputDecoration &&
          (widget.decoration as InputDecoration).labelText ==
              "What did you observe?",
    );
    await tester.scrollUntilVisible(descriptionField, 400,
        scrollable: scrollable);
    await tester.enterText(descriptionField, "Seen heading east");
    await tester.scrollUntilVisible(
      find.text("Submit sighting"),
      400,
      scrollable: scrollable,
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

  testWidgets("manual sighting location submits entered coordinates",
      (tester) async {
    Map<String, dynamic>? payload;
    final submitService = _FakeBroadcastSubmissionService(
      onSubmit: (value) async => payload = value,
    );
    final session = _FakeBroadcastSession(
      detail: BroadcastFeedItem(
        id: "b1",
        type: "StolenVehicle",
        title: "Stolen vehicle alert",
        body: "body",
        priority: "P2Urgent",
        read: false,
        publishedAt: DateTime.utc(2026, 8, 1),
        status: "Active",
      ),
      submissionService: submitService,
    );

    await tester.pumpWidget(
      wrap(
        const SubmitSightingScreen(broadcastId: "b1"),
        session: session,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text("Enter manually"));
    await tester.pumpAndSettle();
    await tester.enterText(
        find.widgetWithText(TextField, "Latitude"), "6.524379");
    await tester.enterText(
        find.widgetWithText(TextField, "Longitude"), "3.379206");

    final scrollable = find.byType(Scrollable).first;
    final descriptionField = find.byWidgetPredicate(
      (widget) =>
          widget is TextField &&
          widget.decoration is InputDecoration &&
          (widget.decoration as InputDecoration).labelText ==
              "What did you observe?",
    );
    await tester.scrollUntilVisible(descriptionField, 400,
        scrollable: scrollable);
    await tester.enterText(descriptionField, "Seen near the roundabout");
    await tester.scrollUntilVisible(
      find.text("Submit sighting"),
      400,
      scrollable: scrollable,
    );
    await tester.tap(find.text("Submit sighting"));
    await tester.pumpAndSettle();

    expect(payload?["locationMode"], "MANUAL");
    expect(payload?["latitude"], 6.524379);
    expect(payload?["longitude"], 3.379206);
  });
}
