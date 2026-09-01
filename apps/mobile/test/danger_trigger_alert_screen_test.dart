import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/danger_trigger/danger_alert_audio_coordinator.dart";
import "package:the_eye_mobile/danger_trigger/danger_trigger_alert_screen.dart";
import "package:the_eye_mobile/danger_trigger/danger_trigger_service.dart";

class _Gateway implements DangerTriggerGateway {
  _Gateway({this.detailError, this.voiceError});

  final DangerTriggerException? detailError;
  final DangerTriggerException? voiceError;
  int voiceAccessCalls = 0;

  @override
  Future<DangerTriggerEventDetail> detail({
    required String accessToken,
    required String eventId,
  }) async {
    if (detailError != null) throw detailError!;
    return const DangerTriggerEventDetail(
      id: "event-1",
      state: "ACTIVE",
      approximateArea: "Allen Avenue, Ikeja, Lagos",
      liveAvailable: false,
      originalVoiceAvailable: true,
      radiusMeters: 4000,
    );
  }

  @override
  Future<DangerTriggerOriginalVoiceAccess> originalVoice({
    required String accessToken,
    required String eventId,
  }) async {
    voiceAccessCalls += 1;
    if (voiceError != null) throw voiceError!;
    return DangerTriggerOriginalVoiceAccess(
      signedUrl: "https://signed.example/voice-$voiceAccessCalls",
      expiresInSeconds: 300,
    );
  }

  @override
  Future<DangerTriggerActivation> activate({
    required String accessToken,
    required String eventId,
    required String liveSessionId,
    required DateTime connectedAt,
  }) async =>
      throw UnimplementedError();

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
  Future<DangerTriggerListenSession> listen({
    required String accessToken,
    required String eventId,
  }) async =>
      throw UnimplementedError();

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
    String? spokenLocationName,
  }) async =>
      throw UnimplementedError();
}

class _Player implements OriginalVoicePlayer {
  final playedUrls = <String>[];

  @override
  Future<void> play(String signedUrl) async => playedUrls.add(signedUrl);

  @override
  Future<void> pause() async {}

  @override
  Future<void> stop() async {}

  @override
  Future<void> dispose() async {}
}

Widget _app(_Gateway gateway, _Player player) => MaterialApp(
      home: DangerTriggerAlertScreen(
        eventId: "event-1",
        apiClient: TheEyeApiClient(baseUrl: "https://api.example.com/v1"),
        accessTokenProvider: () => "access-token",
        gateway: gateway,
        originalVoicePlayer: player,
      ),
      routes: {
        "/report/emergency": (_) =>
            const Scaffold(body: Text("Emergency report")),
      },
    );

void main() {
  testWidgets(
    "shows flat recipient details and refreshes signed voice access for replay",
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final gateway = _Gateway();
      final player = _Player();

      await tester.pumpWidget(_app(gateway, player));
      await tester.pumpAndSettle();

      expect(find.text("Allen Avenue, Ikeja, Lagos"), findsOneWidget);
      expect(find.textContaining("precise location remains private"),
          findsOneWidget);
      expect(find.byType(Card), findsNothing);
      expect(
        find.textContaining("Live broadcast ended"),
        findsOneWidget,
      );
      expect(find.text("Play original voice"), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.tap(find.text("Play original voice"));
      await tester.pumpAndSettle();
      expect(player.playedUrls, ["https://signed.example/voice-1"]);
      expect(find.text("Replay original voice"), findsOneWidget);

      await tester.tap(find.text("Replay original voice"));
      await tester.pumpAndSettle();
      expect(player.playedUrls, [
        "https://signed.example/voice-1",
        "https://signed.example/voice-2",
      ]);
      expect(gateway.voiceAccessCalls, 2);
    },
  );

  testWidgets("shows a distinct authorization failure for original voice", (
    tester,
  ) async {
    final gateway = _Gateway(
      voiceError: const DangerTriggerException(
        "Forbidden",
        statusCode: 403,
      ),
    );
    await tester.pumpWidget(_app(gateway, _Player()));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Play original voice"));
    await tester.pumpAndSettle();

    expect(
      find.text("Sign in again to play the original voice recording."),
      findsOneWidget,
    );
  });

  testWidgets("does not claim voice availability when alert details fail", (
    tester,
  ) async {
    final gateway = _Gateway(
      detailError: const DangerTriggerException(
        "This local danger event is outside your authorized area",
        statusCode: 403,
      ),
    );

    await tester.pumpWidget(_app(gateway, _Player()));
    await tester.pumpAndSettle();

    expect(
      find.text("Original voice availability could not be verified"),
      findsOneWidget,
    );
    expect(find.text("Play original voice"), findsNothing);
  });
}
