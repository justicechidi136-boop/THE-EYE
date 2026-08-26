import "dart:io";

import "package:flutter_test/flutter_test.dart";

void main() {
  test("Neighborhood Watch Feed keeps approved order and one creation entry",
      () {
    final source =
        File("lib/neighborhood_watch/nw_home_screen.dart").readAsStringSync();
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
        "Share the first local update, or open Community Chat to talk with your neighborhood.",
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

  test("Neighborhood Watch geographic chat keeps an active empty-room composer",
      () {
    final source = File(
      "lib/neighborhood_watch/geo_community_chat_view.dart",
    ).readAsStringSync();

    expect(source, contains("No conversations here yet"));
    expect(source, contains("Be the first to start a conversation"));
    expect(source, contains("Message your neighborhood..."));
    expect(source, contains("Add photo, video, or voice note"));
    expect(source, isNot(contains("Share First Security Tip")));
    expect(source, isNot(contains("floatingActionButton:")));
  });
}
