import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/broadcasts/broadcast_filter_sheet.dart";

void main() {
  test("filter count tracks type, status and location", () {
    expect(const BroadcastFeedFilters().activeCount, 0);
    expect(
      const BroadcastFeedFilters(
        category: "StolenVehicle",
        status: "Resolved",
        location: BroadcastLocationFilter.nearMe,
      ).activeCount,
      3,
    );
  });

  testWidgets("filter sheet applies and resets supported filters",
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    BroadcastFeedFilters? result;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: FilledButton(
              onPressed: () async {
                result = await showBroadcastFilterSheet(
                  context,
                  initial: const BroadcastFeedFilters(),
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
    expect(find.text("BROADCAST TYPE"), findsOneWidget);
    expect(find.text("STATUS"), findsOneWidget);
    expect(find.text("LOCATION"), findsOneWidget);

    await tester.tap(find.text("Stolen Vehicle"));
    await tester.tap(find.text("Resolved"));
    final nearMe = find.widgetWithText(ChoiceChip, "Near me");
    await tester.scrollUntilVisible(
      nearMe,
      150,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(nearMe);
    await tester.tap(find.widgetWithText(FilledButton, "Show results"));
    await tester.pumpAndSettle();

    expect(result?.category, "StolenVehicle");
    expect(result?.status, "Resolved");
    expect(result?.location, BroadcastLocationFilter.nearMe);
  });
}
