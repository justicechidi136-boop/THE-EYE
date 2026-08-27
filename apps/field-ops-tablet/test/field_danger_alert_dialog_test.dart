import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_field_ops/danger_alerts/field_danger_alert.dart';
import 'package:the_eye_field_ops/danger_alerts/field_danger_alert_dialog.dart';

void main() {
  testWidgets('danger alert fits a short landscape tablet without overlap', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1280, 600);
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
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: FieldDangerAlertDialog(
            alert: alert,
            elapsedLabel: '1 minute',
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
    expect(tester.takeException(), isNull);
  });
}
