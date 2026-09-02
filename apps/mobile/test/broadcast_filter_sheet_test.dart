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
    expect(find.text("Broadcast type"), findsOneWidget);
    expect(find.text("Status"), findsOneWidget);
    expect(find.text("Location"), findsOneWidget);

    await tester.tap(find.byKey(const Key("broadcast-filter-type")));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Stolen Vehicle").last);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key("broadcast-filter-status")));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Resolved").last);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key("broadcast-filter-location")));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Near me").last);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, "Show results"));
    await tester.pumpAndSettle();

    expect(result?.category, "StolenVehicle");
    expect(result?.status, "Resolved");
    expect(result?.location, BroadcastLocationFilter.nearMe);
  });

  testWidgets("filter sheet keeps status aligned above Android navigation",
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    tester.view.viewPadding = const FakeViewPadding(bottom: 28);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetViewPadding);

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: FilledButton(
              onPressed: () => showBroadcastFilterSheet(
                context,
                initial: const BroadcastFeedFilters(),
              ),
              child: const Text("Open"),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text("Open"));
    await tester.pumpAndSettle();

    final dropdownRects = [
      for (final key in const [
        Key("broadcast-filter-type"),
        Key("broadcast-filter-status"),
        Key("broadcast-filter-location"),
      ])
        tester.getRect(find.byKey(key)),
    ];
    for (var first = 0; first < dropdownRects.length; first++) {
      expect(dropdownRects[first].left, greaterThanOrEqualTo(0));
      expect(dropdownRects[first].right, lessThanOrEqualTo(390));
      for (var second = first + 1; second < dropdownRects.length; second++) {
        expect(dropdownRects[first].overlaps(dropdownRects[second]), isFalse);
      }
    }

    final showResults = find.byKey(
      const Key("broadcast-filter-show-results"),
    );
    expect(showResults, findsOneWidget);
    expect(tester.getBottomRight(showResults).dy, lessThanOrEqualTo(816));
    expect(tester.takeException(), isNull);
  });

  testWidgets("reset restores all default choices before applying",
      (tester) async {
    BroadcastFeedFilters? result;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: FilledButton(
              onPressed: () async {
                result = await showBroadcastFilterSheet(
                  context,
                  initial: const BroadcastFeedFilters(
                    category: "StolenVehicle",
                    status: "Resolved",
                    location: BroadcastLocationFilter.nearMe,
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
    await tester.tap(find.byKey(const Key("broadcast-filter-reset")));
    await tester.pump();

    expect(find.text("All"), findsNWidgets(2));
    expect(find.text("All locations"), findsOneWidget);

    await tester.tap(find.byKey(const Key("broadcast-filter-show-results")));
    await tester.pumpAndSettle();
    expect(result?.activeCount, 0);
  });

  for (final size in const [
    Size(390, 844),
    Size(412, 915),
    Size(480, 960),
    Size(768, 1024),
  ]) {
    testWidgets("filter dropdowns fit cleanly at ${size.width.toInt()}px",
        (tester) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: FilledButton(
                onPressed: () => showBroadcastFilterSheet(
                  context,
                  initial: const BroadcastFeedFilters(),
                ),
                child: const Text("Open"),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text("Open"));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key("broadcast-filter-type")), findsOneWidget);
      expect(find.byKey(const Key("broadcast-filter-status")), findsOneWidget);
      expect(
          find.byKey(const Key("broadcast-filter-location")), findsOneWidget);
      expect(
        find.byKey(const Key("broadcast-filter-show-results")),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    });
  }
}
