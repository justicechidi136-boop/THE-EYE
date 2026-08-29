import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/main.dart";

void main() {
  testWidgets("secondary safety pages use the canonical global navigation",
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: SafetyScaffold(
          title: "Incident status",
          body: SizedBox.shrink(),
        ),
      ),
    );

    expect(find.text("Home"), findsOneWidget);
    expect(find.text("Watch"), findsOneWidget);
    expect(find.text("Broadcasts"), findsOneWidget);
    expect(find.text("Settings"), findsOneWidget);
    expect(find.bySemanticsLabel("Send SOS emergency alert"), findsOneWidget);

    expect(find.text("Police"), findsNothing);
    expect(find.text("Tracking"), findsNothing);
    expect(find.text("Family"), findsNothing);
    expect(find.text("Profile"), findsNothing);
  });

  testWidgets("secondary safety page keeps nested back navigation",
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        routes: {
          "/detail": (_) => const SafetyScaffold(
                title: "SOS device",
                body: SizedBox.shrink(),
              ),
        },
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () => Navigator.of(context).pushNamed("/detail"),
            child: const Text("Open detail"),
          ),
        ),
      ),
    );

    await tester.tap(find.text("Open detail"));
    await tester.pumpAndSettle();
    expect(find.text("SOS device"), findsOneWidget);

    await tester.tap(find.byTooltip("Back"));
    await tester.pumpAndSettle();
    expect(find.text("Open detail"), findsOneWidget);
  });
}
