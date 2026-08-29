import "dart:io";

import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/neighborhood_watch/nw_home_screen.dart";

void main() {
  test("Neighborhood Watch Feed keeps approved order and one creation entry",
      () {
    final source =
        File("lib/neighborhood_watch/nw_home_screen.dart").readAsStringSync();
    final nearby = source.indexOf("What's happening nearby");
    final safetySummary = source.indexOf("Safety summary");

    expect(source, contains('title: "Neighborhood Watch"'));
    expect(source, contains("locationParts.join"));
    expect(nearby, greaterThan(-1));
    expect(safetySummary, greaterThan(nearby));
    expect(source, contains("Eyes · See what is happening around you"));
    expect(source, contains(r'label: Text("Like ${post.reactionCount}")'));
    expect(source, contains(r'label: Text("Comment ${post.commentCount}")'));
    expect(source, contains('label: const Text("Share")'));
    expect(source, contains("neighborhoodVerificationLabel"));
    expect(source, contains("formatNeighborhoodPostAge"));
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
    expect(source, contains("Add photo, video, GIF, sticker, or voice note"));
    expect(source, contains("GIFs and stickers"));
    expect(source, isNot(contains("chat-expression-button")));
    expect(source, isNot(contains('text: "Emoji"')));
    expect(source, isNot(contains("Share First Security Tip")));
    expect(source, isNot(contains("floatingActionButton:")));
  });

  test("feed metadata uses readable relative time and verification labels", () {
    final now = DateTime(2026, 8, 29, 12);
    expect(
      formatNeighborhoodPostAge(
        DateTime(2026, 8, 29, 10),
        now: now,
      ),
      "2h ago",
    );
    expect(neighborhoodVerificationLabel("Verified"), "Verified");
    expect(
      neighborhoodVerificationLabel("PendingVerification"),
      "Unverified",
    );
  });
}
