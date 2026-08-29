import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/emergency/active_emergencies_selector_screen.dart";
import "package:the_eye_mobile/emergency/active_emergency_store.dart";

const incidentId = "11111111-1111-1111-1111-111111111111";

ActiveEmergencySnapshot _snapshot() => ActiveEmergencySnapshot(
      incidentId: incidentId,
      status: "Verifying",
      title: "Road accident",
      type: "Accident",
      agencyName: "",
      timeline: const [],
      publicReference: "EYE-260829-A172",
      reportedAt: DateTime.utc(2026, 8, 29, 12, 30),
      unreadUpdatesCount: 3,
    );

Widget _app(Future<List<ActiveEmergencySnapshot>> Function() loader) {
  return MaterialApp(
    routes: {
      "/active-emergency/$incidentId": (_) =>
          const Scaffold(body: Text("Active emergency detail")),
    },
    home: ActiveEmergenciesSelectorScreen(loadItems: loader),
  );
}

void main() {
  testWidgets("uses the canonical incident summary card without technical IDs",
      (tester) async {
    await tester.pumpWidget(_app(() async => [_snapshot()]));
    await tester.pumpAndSettle();

    expect(find.text("Accident"), findsOneWidget);
    expect(find.text("EYE-260829-A172"), findsOneWidget);
    expect(find.text("Verifying"), findsOneWidget);
    expect(find.text("3"), findsOneWidget);
    expect(find.textContaining("11111111"), findsNothing);

    await tester.tap(find.text("EYE-260829-A172"));
    await tester.pumpAndSettle();
    expect(find.text("Active emergency detail"), findsOneWidget);
  });

  testWidgets("shows a usable empty state", (tester) async {
    await tester.pumpWidget(_app(() async => const []));
    await tester.pumpAndSettle();

    expect(find.text("No active emergencies"), findsOneWidget);
    expect(
      find.text("You do not have an active emergency report right now."),
      findsOneWidget,
    );
  });

  testWidgets("shows retry when list loading fails", (tester) async {
    var attempts = 0;
    await tester.pumpWidget(_app(() async {
      attempts += 1;
      throw StateError("offline");
    }));
    await tester.pumpAndSettle();

    expect(find.text("Unable to load active emergencies"), findsOneWidget);
    expect(find.text("Retry"), findsOneWidget);
    await tester.tap(find.text("Retry"));
    await tester.pumpAndSettle();
    expect(attempts, 2);
  });
}
