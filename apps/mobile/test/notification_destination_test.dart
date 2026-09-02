import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/notifications/notification_destination.dart";
import "package:the_eye_mobile/notifications/notification_inbox_service.dart";

InboxNotificationItem item({
  String? deepLink,
  String? broadcastId,
  String type = "BroadcastAlert",
  Map<String, dynamic> metadata = const {},
}) {
  return InboxNotificationItem(
    id: "n1",
    type: type,
    title: "Missing person alert",
    body: "Nearby alert",
    priority: "High",
    deliveryStatus: "Delivered",
    read: false,
    createdAt: DateTime.utc(2026, 8, 12),
    deepLink: deepLink,
    broadcastId: broadcastId,
    metadata: metadata,
  );
}

void main() {
  test("uses broadcastId when deepLink is generic center route", () {
    expect(
      resolveInboxNotificationDestination(
        item(deepLink: "/broadcasts", broadcastId: "b-123"),
      ),
      "/broadcasts/b-123",
    );
  });

  test("uses broadcastId when deepLink is missing", () {
    expect(
      resolveInboxNotificationDestination(item(broadcastId: "b-9")),
      "/broadcasts/b-9",
    );
  });

  test("keeps explicit broadcast detail deepLink", () {
    expect(
      resolveInboxNotificationDestination(
        item(deepLink: "/broadcasts/b-explicit", broadcastId: "b-other"),
      ),
      "/broadcasts/b-explicit",
    );
  });

  test("falls back to notifications when nothing resolvable", () {
    expect(resolveInboxNotificationDestination(item()), "/notifications");
  });

  test("routes a nearby danger warning by its authorized event id", () {
    expect(
      resolveInboxNotificationDestination(
        item(
          type: "NearbyDangerWarning",
          deepLink: "/active-emergency",
          metadata: const {"dangerEventId": "danger-event-1"},
        ),
      ),
      "/danger-trigger/events/danger-event-1",
    );
  });
}
