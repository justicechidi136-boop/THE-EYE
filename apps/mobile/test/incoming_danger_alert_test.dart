import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/danger_trigger/incoming_danger_alert.dart";

Map<String, dynamic> payload({int version = 1, DateTime? expiresAt}) => {
      "type": "NearbyDangerWarning",
      "alertId": "danger-event:event-1:user-1",
      "alertVersion": "$version",
      "alertLifecycleState": "ACTIVE",
      "dangerAlertCode": "DANGER_ZONE_FIRE_NEARBY",
      "zoneId": "event-1",
      "areaName": "Rumuola",
      "distanceMeters": "700",
      "issuedAt": DateTime.now().toUtc().toIso8601String(),
      "expiresAt":
          (expiresAt ?? DateTime.now().add(const Duration(minutes: 20)))
              .toUtc()
              .toIso8601String(),
    };

void main() {
  test("uses trusted danger category and approximate area", () {
    final alert = IncomingDangerAlert.fromData(payload());
    expect(alert, isNotNull);
    expect(alert!.dangerType, "Fire");
    expect(alert.area, "Rumuola");
    expect(alert.spokenText, "Danger alert. Fire reported in Rumuola.");
    expect(alert.dedupeKey, "danger-event:event-1:user-1:1");
  });

  test("rejects arbitrary category and expired alerts", () {
    expect(
      IncomingDangerAlert.fromData(
          {...payload(), "dangerAlertCode": "USER_TEXT"}),
      isNull,
    );
    expect(
      IncomingDangerAlert.fromData(
        payload(expiresAt: DateTime.now().subtract(const Duration(seconds: 1))),
      ),
      isNull,
    );
  });
}
