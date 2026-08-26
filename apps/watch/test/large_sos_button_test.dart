import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/design_system/components/large_sos_button.dart';

void main() {
  testWidgets('SOS tap provides guidance without starting activation',
      (tester) async {
    var tapped = false;
    var holdStarted = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: LargeSosButton(
            onTap: () => tapped = true,
            onHoldStart: () => holdStarted = true,
            onHoldEnd: () {},
          ),
        ),
      ),
    );

    await tester.tap(find.text('SOS'));
    await tester.pump();

    expect(tapped, isTrue);
    expect(holdStarted, isFalse);
  });
}
