import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/push/push_notification_channels.dart";

void main() {
  test("maps critical alerts to emergency channel", () {
    expect(
      PushNotificationChannels.resolveChannelId(
          type: "EmergencyAlert", priority: "Critical"),
      PushNotificationChannels.emergency.id,
    );
  });

  test("maps nearby danger alerts to the dedicated wake channel", () {
    expect(
      PushNotificationChannels.resolveChannelId(
        type: "NearbyDangerWarning",
        priority: "Critical",
        route: "/danger-trigger/events/event-1",
      ),
      PushNotificationChannels.dangerAlerts.id,
    );
  });

  test("maps missing person alerts to dedicated channel", () {
    expect(
      PushNotificationChannels.resolveChannelId(type: "MissingPersonAlert"),
      PushNotificationChannels.missingPersons.id,
    );
  });

  test("maps neighborhood watch alerts to dedicated channel", () {
    expect(
      PushNotificationChannels.resolveChannelId(
          route: "/neighborhood-watch/alerts"),
      PushNotificationChannels.neighborhoodWatch.id,
    );
  });
}
