import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/police/police_stations_screen.dart";

void main() {
  testWidgets("Nearby police screen shows back header", (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            return Scaffold(
              body: ElevatedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) =>
                          const NearbyPoliceStationsScreen(autoload: false),
                    ),
                  );
                },
                child: const Text("Open"),
              ),
            );
          },
        ),
      ),
    );

    await tester.tap(find.text("Open"));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text("Nearby police"), findsWidgets);
    expect(find.byTooltip("Back"), findsOneWidget);

    await tester.tap(find.byTooltip("Back"));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text("Open"), findsOneWidget);
  });
}
