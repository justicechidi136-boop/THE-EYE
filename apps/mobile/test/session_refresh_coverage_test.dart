import "dart:io";

import "package:flutter_test/flutter_test.dart";

void main() {
  test("application creates one canonical refresh-aware API client", () {
    final source = File("lib/main.dart").readAsStringSync();

    expect(RegExp(r"TheEyeApiClient\(").allMatches(source).length, 1);
    expect(
      source.contains("accessTokenProvider: () => controller?.accessToken"),
      isTrue,
    );
    expect(
      source.contains("onUnauthorizedRefresh: (rejectedAccessToken) async"),
      isTrue,
    );
    expect(source.contains("apiClient: controller.apiClient"), isTrue);
  });

  test("authenticated feature screens do not construct default services", () {
    final sources = [
      "lib/activity/activity_history_screen.dart",
      "lib/activity/broadcast_archive_screen.dart",
      "lib/broadcasts/broadcast_screens.dart",
      "lib/neighborhood_watch/community_members_screen.dart",
      "lib/neighborhood_watch/community_post_detail_screen.dart",
      "lib/neighborhood_watch/community_report_screen.dart",
      "lib/neighborhood_watch/nw_home_screen.dart",
      "lib/neighborhood_watch/private_community_membership_screen.dart",
      "lib/support/support_chat_screens.dart",
      "lib/support/support_home_screen.dart",
    ].map((path) => File(path).readAsStringSync()).join("\n");

    expect(sources.contains("NeighborhoodWatchService();"), isFalse);
    expect(sources.contains("BroadcastMediaUploadService();"), isFalse);
    expect(sources.contains("SupportService();"), isFalse);
    expect(sources.contains("ActivityHistoryService();"), isFalse);
  });

  test("background coordinators resolve the latest token per operation", () {
    final pending = File("lib/connectivity/pending_retry_coordinator.dart")
        .readAsStringSync();
    final push =
        File("lib/push/push_notification_service.dart").readAsStringSync();

    expect(pending.contains("accessToken: _accessTokenProvider()"), isTrue);
    expect(
      RegExp(r"_accessTokenProvider\(\)").allMatches(push).length >= 2,
      isTrue,
    );
  });
}
