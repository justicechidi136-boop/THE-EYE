import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/navigation/navigate_back_or_home.dart";

void main() {
  testWidgets("pops when the navigator can pop", (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (context) => Scaffold(
                      body: TextButton(
                        key: const Key("back"),
                        onPressed: () => navigateBackOrHome(context),
                        child: const Text("Back"),
                      ),
                    ),
                  ),
                );
              },
              child: const Text("Open"),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text("Open"));
    await tester.pumpAndSettle();
    expect(find.text("Back"), findsOneWidget);

    await tester.tap(find.byKey(const Key("back")));
    await tester.pumpAndSettle();
    expect(find.text("Open"), findsOneWidget);
    expect(find.text("Back"), findsNothing);
  });

  testWidgets("replaces with home when stack cannot pop", (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        routes: {
          "/home": (_) => const Scaffold(body: Text("Home")),
        },
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              key: const Key("back"),
              onPressed: () => navigateBackOrHome(context),
              child: const Text("Back"),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(const Key("back")));
    await tester.pumpAndSettle();
    expect(find.text("Home"), findsOneWidget);
    expect(find.text("Back"), findsNothing);
  });
}
