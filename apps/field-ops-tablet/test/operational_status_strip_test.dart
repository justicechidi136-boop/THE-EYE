import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_field_ops/launcher/widgets/operational_status_strip.dart';

void main() {
  testWidgets('shows a discoverable amber danger alert control', (
    tester,
  ) async {
    var pressed = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: OperationalStatusStrip(
            gpsLabel: 'Allen Avenue, Ikeja, Lagos',
            networkLabel: 'Wi-Fi',
            batteryLabel: '82%',
            syncLabel: 'OK',
            shiftLabel: 'Active',
            modeLabel: 'Patrol',
            assignmentLabel: 'None',
            unreadAlerts: 0,
            dangerAlertActive: true,
            onDangerAlertPressed: () => pressed = true,
          ),
        ),
      ),
    );

    expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
    expect(find.text('DANGER'), findsOneWidget);
    expect(find.text('ACTIVE'), findsOneWidget);

    await tester.tap(find.text('ACTIVE'));
    expect(pressed, isTrue);
  });
}
