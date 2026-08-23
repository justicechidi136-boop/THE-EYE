import "dart:io";

import "package:flutter_test/flutter_test.dart";

void main() {
  test("Neighborhood Watch Home keeps approved order and one creation entry", () {
    final source = File("lib/neighborhood_watch/nw_home_screen.dart")
        .readAsStringSync();
    final currentArea = source.indexOf("Current area");
    final safetySummary = source.indexOf("Safety summary");
    final nearby = source.indexOf("What's happening nearby");

    expect(currentArea, greaterThan(-1));
    expect(safetySummary, greaterThan(currentArea));
    expect(nearby, greaterThan(safetySummary));
    expect(source, contains("Nothing happening nearby right now"));
    expect(
      source,
      contains(
        "Be the first to share something that can help keep the community safe.",
      ),
    );
    expect(source, contains("floatingActionButton:"));
    for (final removed in [
      "Share with your area",
      "Share Security Tip",
      "Report Activity",
      "Report Road Hazard",
      "Start Conversation",
      "Switch to Active Emergency",
      'label: "Alerts"',
      'label: "Patrol"',
    ]) {
      expect(source, isNot(contains(removed)));
    }
  });

  test("Neighborhood Watch Feed uses approved filters and notice placement", () {
    final appSource = File("lib/main.dart").readAsStringSync();
    final start = appSource.indexOf("class _CommunityFeedScreenState");
    final end = appSource.indexOf("class _SelectedCommunityLocation", start);
    final source = appSource.substring(start, end);

    expect(source, contains('"All",'));
    expect(source, contains('"Discussions",'));
    expect(source, contains('"Tips",'));
    expect(source, contains('"Traffic",'));
    expect(source, isNot(contains('"Activity",')));
    expect(source, isNot(contains('"Hazards",')));
    expect(source, isNot(contains("Share Security Tip")));
    expect(source, isNot(contains("Report Activity")));
    expect(source, isNot(contains("Report Road Hazard")));
    expect(source, isNot(contains("Report Emergency")));
    expect(source, contains("floatingActionButton:"));
    expect(source, contains("No community discussions yet"));
    expect(source, contains("Share First Security Tip"));
    expect(
      source.indexOf("Community Notice"),
      lessThan(source.indexOf("loadingCommunityFeed")),
    );
    expect(source, contains('"Like"'));
    expect(source, contains("Comment"));
    expect(source, contains('label: const Text("Share")'));
  });
}
