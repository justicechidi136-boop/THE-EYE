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

  @override
  Future<PreparedDangerTrigger> prepare({
    required String accessToken,
    required String clientTriggerId,
    required double latitude,
    required double longitude,
    required DateTime locationCapturedAt,
    required String locationSource,
    double? accuracyMeters,
    String? areaName,
  }) async =>
      PreparedDangerTrigger(
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

void main() {
  testWidgets("shows the explicit danger actions with human-readable location",
      (tester) async {
    final gateway = _FakeGateway();
    await tester.pumpWidget(_app(connects: true, gateway: gateway));
    await tester.pumpAndSettle();

    expect(find.text("Start Live Danger Broadcast"), findsOneWidget);
    expect(find.text("Report Immediate Danger"), findsOneWidget);
    expect(find.text("Ikeja, Lagos"), findsOneWidget);
    expect(
        find.textContaining("microphone activates only after"), findsOneWidget);
  });

  testWidgets("does not show broadcasting or activate alerts before connection",
      (tester) async {
    final gateway = _FakeGateway();
    await tester.pumpWidget(_app(connects: false, gateway: gateway));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Start Live Danger Broadcast"));
    await tester.pumpAndSettle();

    expect(find.text("Live voice broadcasting"), findsNothing);
    expect(gateway.activateCalls, 0);
    expect(find.text("Failed"), findsOneWidget);
  });

  testWidgets("shows broadcasting only after connection and activation",
      (tester) async {
    final gateway = _FakeGateway();
    await tester.pumpWidget(_app(connects: true, gateway: gateway));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Start Live Danger Broadcast"));
    await tester.pumpAndSettle();

    expect(gateway.activateCalls, 1);
    expect(find.text("Live voice broadcasting"), findsOneWidget);
    expect(find.text("Alert active. Alerts sent to 3 nearby users."),
        findsOneWidget);
    expect(find.text("Paired smartwatch alerted."), findsOneWidget);
    expect(find.text("End live voice"), findsOneWidget);
  });
}
