import "package:flutter_test/flutter_test.dart";

import "../lib/broadcasts/broadcast_feed_service.dart";

void main() {
  test("BroadcastFeedItem parses citizen labels and status", () {
    final item = BroadcastFeedItem.fromJson({
      "id": "broadcast-1",
      "type": "MissingPerson",
      "title": "Missing person: Ada",
      "body": "Last seen near Ikeja.",
      "priority": "P2ActiveCrimeAccident",
      "read": false,
      "publishedAt": "2026-08-06T10:00:00.000Z",
      "status": "Active",
      "authorLabel": "Citizen Broadcast",
      "adminVerified": false,
      "country": "NG",
      "state": "Lagos",
      "commentsCount": 2,
      "deepLink": "/broadcasts/broadcast-1",
    });

    expect(item.status, "Active");
    expect(item.authorLabel, "Citizen Broadcast");
    expect(item.country, "NG");
    expect(item.commentsCount, 2);
    expect(item.deepLink, "/broadcasts/broadcast-1");
  });
}
