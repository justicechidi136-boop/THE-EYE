import "package:flutter_test/flutter_test.dart";
import "package:shared_preferences/shared_preferences.dart";

import "package:the_eye_mobile/notifications/notification_inbox_cache.dart";
import "package:the_eye_mobile/notifications/notification_inbox_service.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test("maps inbox item fields from API json", () {
    final item = InboxNotificationItem.fromJson({
      "id": "n1",
      "type": "EmergencyAlert",
      "title": "Alert",
      "body": "Body",
      "priority": "Critical",
      "deliveryStatus": "Queued",
      "read": false,
      "createdAt": "2026-07-22T00:00:00.000Z",
      "deepLink": "/tracking",
    });
    expect(item.delivery, "Queued");
    expect(item.deepLink, "/tracking");
    expect(item.read, isFalse);
  });

  test("notification cache is scoped and cleared per user key", () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final cache = NotificationInboxCache(preferences: prefs);
    final item = InboxNotificationItem.fromJson({
      "id": "n1",
      "type": "BroadcastAlert",
      "title": "Notice",
      "body": "Road closed",
      "priority": "High",
      "deliveryStatus": "Delivered",
      "read": false,
      "createdAt": "2026-07-22T00:00:00.000Z",
    });

    await cache.save("user-a", [item]);
    expect(await cache.load("user-a"), hasLength(1));
    expect(await cache.load("user-b"), isEmpty);

    await cache.clear("user-a");
    expect(await cache.load("user-a"), isEmpty);
  });

  test("duplicate sighting delivery is one logical inbox item", () {
    final items = [
      InboxNotificationItem.fromJson({
        "id": "push-row",
        "type": "BroadcastSightingAlert",
        "title": "New sighting",
        "body": "Possible sighting",
        "priority": "High",
        "createdAt": "2026-08-20T10:00:00.000Z",
        "metadata": {
          "idempotencyKey": "broadcast-sighting:sighting-1:owner-1",
        },
      }),
      InboxNotificationItem.fromJson({
        "id": "retry-row",
        "type": "BroadcastSightingAlert",
        "title": "New sighting",
        "body": "Possible sighting",
        "priority": "High",
        "createdAt": "2026-08-20T10:00:01.000Z",
        "metadata": {
          "idempotencyKey": "broadcast-sighting:sighting-1:owner-1",
        },
      }),
    ];

    final deduped = deduplicateLogicalNotifications(items);
    expect(deduped, hasLength(1));
    expect(deduped.single.id, "push-row");
  });

  test("duplicate report submission delivery is one logical inbox item", () {
    final items = [
      InboxNotificationItem.fromJson({
        "id": "report-push-row",
        "type": "IncidentStatusUpdate",
        "title": "Your crime report has been received",
        "body":
            "Your crime report EYE-260829-A172 has been successfully submitted.",
        "priority": "Normal",
        "createdAt": "2026-08-29T10:00:00.000Z",
        "metadata": {
          "idempotencyKey": "incident:incident-1:report-submitted:user-1",
        },
      }),
      InboxNotificationItem.fromJson({
        "id": "report-retry-row",
        "type": "IncidentStatusUpdate",
        "title": "Your crime report has been received",
        "body":
            "Your crime report EYE-260829-A172 has been successfully submitted.",
        "priority": "Normal",
        "createdAt": "2026-08-29T10:00:01.000Z",
        "metadata": {
          "idempotencyKey": "incident:incident-1:report-submitted:user-1",
        },
      }),
    ];

    final deduped = deduplicateLogicalNotifications(items);
    expect(deduped, hasLength(1));
    expect(deduped.single.id, "report-push-row");
  });
}
