import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/push/watch_danger_alert_relay.dart";

void main() {
  group("DangerAlertPhoneHandler", () {
    test("detects relay-eligible nearby danger warning", () {
      expect(
        DangerAlertPhoneHandler.shouldRelayToWatch({
          "type": "NearbyDangerWarning",
          "relayToWatch": "true",
          "dangerAlertCode": "DANGER_ZONE_GENERAL_ENTRY",
        }),
        isTrue,
      );
    });

    test("rejects non-danger notifications", () {
      expect(
        DangerAlertPhoneHandler.shouldRelayToWatch({
          "type": "BroadcastAlert",
          "relayToWatch": "true",
        }),
        isFalse,
      );
    });

    test("requires trusted alert code", () {
      expect(
        DangerAlertPhoneHandler.hasTrustedAlertCode({
          "dangerAlertCode": "DANGER_ZONE_EVACUATION_NEARBY",
        }),
        isTrue,
      );
      expect(
        DangerAlertPhoneHandler.hasTrustedAlertCode({
          "dangerAlertCode": "CUSTOM_TEXT",
        }),
        isFalse,
      );
    });
  });
}
