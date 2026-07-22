import "package:flutter_test/flutter_test.dart";
import "package:shared_preferences/shared_preferences.dart";

import "package:the_eye_mobile/broadcasts/broadcast_feed_cache.dart";
import "package:the_eye_mobile/broadcasts/broadcast_feed_service.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test("maps broadcast feed item fields from API json", () {
    final item = BroadcastFeedItem.fromJson({
      "id": "b1",
      "type": "Emergency",
      "title": "Road closure",
      "body": "Avoid the area",
      "priority": "P1LifeThreatening",
      "read": false,
      "publishedAt": "2026-07-22T00:00:00.000Z",
      "deepLink": "/broadcasts/b1",
    });
    expect(item.id, "b1");
    expect(item.deepLink, "/broadcasts/b1");
    expect(item.read, isFalse);
  });

  test("broadcast feed cache is scoped per user key", () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final cache = BroadcastFeedCache(preferences: prefs);
    final item = BroadcastFeedItem.fromJson({
      "id": "b1",
      "type": "Emergency",
      "title": "Notice",
      "body": "Body",
      "priority": "P2ActiveCrimeAccident",
      "read": false,
      "publishedAt": "2026-07-22T00:00:00.000Z",
    });

    await cache.save("user-a", [item]);
    expect(await cache.load("user-a"), hasLength(1));
    expect(await cache.load("user-b"), isEmpty);

    await cache.clear("user-a");
    expect(await cache.load("user-a"), isEmpty);
  });

  test("duplicate feed items can be prevented by id", () {
    final first = BroadcastFeedItem.fromJson({
      "id": "b1",
      "type": "Emergency",
      "title": "A",
      "body": "Body",
      "priority": "P2ActiveCrimeAccident",
      "read": false,
      "publishedAt": "2026-07-22T00:00:00.000Z",
    });
    final second = first.copyWith(read: true);
    expect(second.id, first.id);
    expect(second.read, isTrue);
  });
}
