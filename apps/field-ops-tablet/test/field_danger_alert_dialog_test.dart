import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_field_ops/danger_alerts/field_danger_alert.dart';
import 'package:the_eye_field_ops/danger_alerts/field_danger_alert_dialog.dart';
import 'package:the_eye_field_ops/danger_alerts/field_danger_alert_service.dart';

void main() {
  testWidgets('danger alert fits a 1280x800 landscape tablet', (tester) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final alert = FieldDangerAlert(
      eventId: 'event-1',
      alertId: 'alert-1',
      version: 1,
      dangerType: 'ACTIVE ROBBERY',
      area: 'A deliberately long operational area label, Port Harcourt, Rivers',
      issuedAt: DateTime.now(),
      distanceMeters: 1400,
      hasOriginalVoice: true,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: FieldDangerAlertDialog(
            alert: alert,
            elapsedLabel: '1 minute',
            audioState: ValueNotifier(FieldDangerAudioState.completed),
            onReplay: () async {},
            onOpenMap: () {},
            onAcknowledge: () {},
          ),
        ),
      ),
    );

    expect(find.text('DANGER ALERT'), findsOneWidget);
    expect(find.text('ACTIVE ROBBERY'), findsOneWidget);
    expect(find.text('About 1.4 km away'), findsOneWidget);
    expect(find.text('Open Map'), findsOneWidget);
    expect(find.text('I have seen this alert'), findsOneWidget);
    expect(find.textContaining('Original voice'), findsOneWidget);
    expect(find.text('Replay audio'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('danger alert remains usable at reduced height and large text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1280, 600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final alert = FieldDangerAlert(
      eventId: 'event-2',
      alertId: 'alert-2',
      version: 1,
      dangerType: 'OTHER IMMEDIATE DANGER REQUIRING URGENT RESPONSE',
      area:
          'A deliberately long operational area label, Port Harcourt, Rivers State',
      issuedAt: DateTime.now(),
      distanceMeters: 350,
    );

    await tester.pumpWidget(
      MaterialApp(
        builder:
            (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: const TextScaler.linear(1.5)),
              child: child!,
            ),
        home: Scaffold(
          body: FieldDangerAlertDialog(
            alert: alert,
            elapsedLabel: '2 minutes',
            audioState: ValueNotifier(FieldDangerAudioState.idle),
            onReplay: () async {},
            onOpenMap: () {},
            onAcknowledge: () {},
          ),
        ),
      ),
    );

    expect(find.text(alert.dangerType), findsOneWidget);
    expect(find.text(alert.area), findsOneWidget);
    expect(find.text('Open Map'), findsOneWidget);
    expect(find.text('I have seen this alert'), findsOneWidget);
    expect(find.byType(SingleChildScrollView), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
