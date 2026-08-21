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

  test(
      "startup keeps credentials in secure storage and hydrates before routing",
      () {
    final mainSource = File("lib/main.dart").readAsStringSync();
    final storeSource =
        File("lib/auth/auth_session_store.dart").readAsStringSync();
    final backgroundPushSource =
        File("lib/push/push_background_handler.dart").readAsStringSync();

    expect(mainSource.contains("SecureAuthSessionStore.create()"), isTrue);
    expect(
      storeSource.contains("FlutterSecureStorage"),
      isTrue,
    );
    expect(storeSource.contains("setString(accessTokenKey"), isFalse);
    expect(storeSource.contains("setString(refreshTokenKey"), isFalse);
    expect(
      backgroundPushSource.contains("FlutterSecureStorage"),
      isTrue,
    );
    expect(
      backgroundPushSource.contains("the_eye.auth.access_token"),
      isFalse,
    );
    expect(
      mainSource.indexOf("final restore = await controller.restoreSession()") <
          mainSource.indexOf("SessionRestoreStatus.restored => \"/home\""),
      isTrue,
    );
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
