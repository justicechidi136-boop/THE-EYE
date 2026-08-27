import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/danger_trigger/danger_trigger_screen.dart";
import "package:the_eye_mobile/danger_trigger/danger_trigger_service.dart";
import "package:the_eye_mobile/live_video/live_video_api_models.dart";
import "package:the_eye_mobile/live_video/live_video_session_controller.dart";
import "package:the_eye_mobile/location/device_location_service.dart";
import "package:the_eye_mobile/location/device_location_state.dart";
import "package:the_eye_mobile/location/emergency_location_fix.dart";
import "package:the_eye_mobile/push/watch_danger_alert_relay.dart";

class _FakeLocationService extends DeviceLocationService {
  @override
  Future<DeviceLocationState> probeCurrentLocation({
    Duration timeout = const Duration(seconds: 15),
    bool requestIfDenied = true,
  }) async =>
      DeviceLocationState(
        status: DeviceLocationStatus.acquired,
        latitude: 6.5244,
        longitude: 3.3792,
        accuracyMeters: 12,
        capturedAt: DateTime.now(),
        source: DeviceLocationSourceKind.freshGps,
        quality: EmergencyLocationQuality.precise,
        locality: "Ikeja",
        state: "Lagos",
      );
}

class _FakeLiveVoiceController extends LiveVideoSessionController {
  _FakeLiveVoiceController({required this.connects}) : super(audioOnly: true);

  final bool connects;

  @override
  Future<LiveVideoPermissionOutcome> ensurePermissions() async =>
      const LiveVideoPermissionOutcome(granted: true);

  @override
  Future<bool> startSession(
    LiveVideoStartResult startResult, {
    String? incidentIdOverride,
  }) async =>
      connects;

  @override
  Future<void> stop({bool keepPreview = false}) async {}
}

class _FakeGateway implements DangerTriggerGateway {
  int activateCalls = 0;
  String? preparedDangerAlertCode;

  @override
  Future<PreparedDangerTrigger> prepare({
    required String accessToken,
    required String clientTriggerId,
    required double latitude,
    required double longitude,
    required DateTime locationCapturedAt,
    required String locationSource,
    required String dangerAlertCode,
    double? accuracyMeters,
    String? areaName,
  }) async {
    preparedDangerAlertCode = dangerAlertCode;
    return PreparedDangerTrigger(
      eventId: "event-1",
      liveSessionId: "session-1",
      approximateArea: "Ikeja, Lagos",
      radiusMeters: 4000,
      liveVideo: LiveVideoStartResult.fromResponse({
        "data": {
          "id": "session-1",
          "incidentId": "incident-1",
          "participantIdentity": "user-1",
        },
        "connection": {
          "serverUrl": "wss://live.example.com",
          "participantToken":
              "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.signature",
          "roomName": "danger-room-1",
          "participantIdentity": "user-1",
        },
      }),
    );
  }

  @override
  Future<DangerTriggerActivation> activate({
    required String accessToken,
    required String eventId,
    required String liveSessionId,
    required DateTime connectedAt,
  }) async {
    activateCalls += 1;
    return const DangerTriggerActivation(
      recipientCount: 3,
      radiusMeters: 4000,
      initiatorWatchAlertQueued: true,
      watchRelayPayload: {
        "type": "NearbyDangerWarning",
        "relayToWatch": "true",
        "dangerAlertCode": "DANGER_ZONE_GENERAL_ENTRY",
      },
    );
  }

  @override
  Future<void> cancel({
    required String accessToken,
    required String eventId,
    String? reason,
  }) async {}

  @override
  Future<void> endLiveVoice({
    required String accessToken,
    required String eventId,
  }) async {}

  @override
  Future<DangerTriggerEventDetail> detail({
    required String accessToken,
    required String eventId,
  }) async =>
      throw UnimplementedError();

  @override
  Future<DangerTriggerListenSession> listen({
    required String accessToken,
    required String eventId,
  }) async =>
      throw UnimplementedError();
}

class _FakeWatchRelay extends WatchDangerAlertRelay {
  @override
  Future<bool> relayDangerAlert(Map<String, dynamic> fcmData) async => true;
}

Widget _app({required bool connects, required _FakeGateway gateway}) {
  return MaterialApp(
    home: DangerTriggerScreen(
      apiClient: TheEyeApiClient(baseUrl: "https://api.example.com/v1"),
      accessTokenProvider: () => "access-token",
      gateway: gateway,
      locationService: _FakeLocationService(),
      liveVoiceController: _FakeLiveVoiceController(connects: connects),
      watchRelay: _FakeWatchRelay(),
    ),
    routes: {
      "/report/emergency": (_) =>
          const Scaffold(body: Text("Emergency report")),
    },
  );
}

Future<void> _scrollTo(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(
    finder,
    220,
    scrollable: find.byType(Scrollable).first,
  );
}

void main() {
  testWidgets(
    "shows the explicit danger actions with human-readable location",
    (tester) async {
      final gateway = _FakeGateway();
      await tester.pumpWidget(_app(connects: true, gateway: gateway));
      await tester.pumpAndSettle();

      expect(find.text("Select danger type"), findsOneWidget);
      expect(find.text("Ikeja, Lagos"), findsOneWidget);
      final start = find.widgetWithText(
        FilledButton,
        "Start Live Danger Broadcast",
      );
      await _scrollTo(tester, start);
      expect(start, findsOneWidget);
      final reportImmediateDanger = find.text("Report Immediate Danger");
      await _scrollTo(tester, reportImmediateDanger);
      expect(reportImmediateDanger, findsOneWidget);
      expect(
        find.textContaining("microphone activates only after"),
        findsOneWidget,
      );
    },
  );

  testWidgets("requires a danger type before activation", (tester) async {
    final gateway = _FakeGateway();
    await tester.pumpWidget(_app(connects: true, gateway: gateway));
    await tester.pumpAndSettle();

    final startFinder = find.widgetWithText(
      FilledButton,
      "Start Live Danger Broadcast",
    );
    await _scrollTo(tester, startFinder);
    expect(tester.widget<FilledButton>(startFinder).onPressed, isNull);
    expect(gateway.activateCalls, 0);
  });

  testWidgets(
    "does not show broadcasting or activate alerts before connection",
    (tester) async {
      final gateway = _FakeGateway();
      await tester.pumpWidget(_app(connects: false, gateway: gateway));
      await tester.pumpAndSettle();
      await tester.tap(
        find.byKey(
          const Key(
            "danger-category-DANGER_ZONE_ARMED_ROBBERY_NEARBY",
          ),
        ),
      );
      await tester.pumpAndSettle();
      final start = find.widgetWithText(
        FilledButton,
        "Start Live Danger Broadcast",
      );
      await _scrollTo(tester, start);
      await tester.tap(start);
      await tester.pumpAndSettle();

      expect(find.text("Live voice broadcasting"), findsNothing);
      expect(gateway.activateCalls, 0);
      expect(
        find.text("Unable to establish the live voice connection."),
        findsOneWidget,
      );
    },
  );

  testWidgets("shows broadcasting only after connection and activation", (
    tester,
  ) async {
    final gateway = _FakeGateway();
    await tester.pumpWidget(_app(connects: true, gateway: gateway));
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(
        const Key("danger-category-DANGER_ZONE_ARMED_ROBBERY_NEARBY"),
      ),
    );
    await tester.pumpAndSettle();
    final start = find.widgetWithText(
      FilledButton,
      "Start Live Danger Broadcast",
    );
    await _scrollTo(tester, start);
    await tester.tap(start);
    await tester.pumpAndSettle();

    expect(gateway.activateCalls, 1);
    expect(gateway.preparedDangerAlertCode, "DANGER_ZONE_ARMED_ROBBERY_NEARBY");
    await _scrollTo(tester, find.text("Live voice broadcasting"));
    expect(find.text("Live voice broadcasting"), findsOneWidget);
    expect(
      find.text("Alert active. Alerts sent to 3 nearby users."),
      findsOneWidget,
    );
    expect(find.text("Paired smartwatch alerted."), findsOneWidget);
    final endVoice = find.widgetWithText(FilledButton, "End live voice");
    await tester.scrollUntilVisible(
      endVoice,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(endVoice, findsOneWidget);
  });

  test("defines the exact trusted nine-category mapping", () {
    expect(
      dangerTriggerCategories
          .map((category) => "${category.label}|${category.code}")
          .toList(growable: false),
      const [
        "Fire|DANGER_ZONE_FIRE_NEARBY",
        "Armed robbery|DANGER_ZONE_ARMED_ROBBERY_NEARBY",
        "Kidnapping|DANGER_ZONE_KIDNAPPING_NEARBY",
        "Shooting / gunfire|DANGER_ZONE_ACTIVE_SHOOTER_NEARBY",
        "Riot|DANGER_ZONE_CIVIL_DISTURBANCE_NEARBY",
        "Bandit / unknown gunmen|DANGER_ZONE_BANDIT_ATTACK_NEARBY",
        "Cult clash|DANGER_ZONE_CULT_CLASH_NEARBY",
        "Community crisis|DANGER_ZONE_COMMUNITY_CRISIS_NEARBY",
        "Killing|DANGER_ZONE_KILLING_NEARBY",
      ],
    );
  });

  testWidgets("renders all category keys without small-screen overflow", (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      _app(connects: true, gateway: _FakeGateway()),
    );
    await tester.pumpAndSettle();

    for (final category in dangerTriggerCategories) {
      expect(
        find.byKey(Key("danger-category-${category.code}")),
        findsOneWidget,
      );
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets("allows changing the category before activation", (tester) async {
    final gateway = _FakeGateway();
    await tester.pumpWidget(_app(connects: true, gateway: gateway));
    await tester.pumpAndSettle();

    await tester.tap(
      find.byKey(const Key("danger-category-DANGER_ZONE_FIRE_NEARBY")),
    );
    await tester.pump();
    await _scrollTo(tester, find.text("Selected danger: FIRE"));
    expect(find.text("Selected danger: FIRE"), findsOneWidget);

    final communityCrisis = find.byKey(
      const Key("danger-category-DANGER_ZONE_COMMUNITY_CRISIS_NEARBY"),
    );
    await _scrollTo(tester, communityCrisis);
    await tester.tap(
      communityCrisis,
    );
    await tester.pump();
    await _scrollTo(tester, find.text("Selected danger: COMMUNITY CRISIS"));
    expect(find.text("Selected danger: COMMUNITY CRISIS"), findsOneWidget);
  });
}
