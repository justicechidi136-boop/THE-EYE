import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/push/push_deep_link_router.dart";

void main() {
  test("routes emergency notifications to emergency report screen", () {
    expect(
      PushDeepLinkRouter.resolveRoute(
          {"type": "EmergencyAlert", "priority": "Critical"}),
      "/report/emergency",
    );
  });

  test("rejects unsafe deep links", () {
    expect(PushDeepLinkRouter.resolveRoute({"route": "https://evil.example"}),
        "/notifications");
    expect(PushDeepLinkRouter.resolveRoute({"route": "/../secrets"}),
        "/notifications");
  });

  test("accepts explicit allowed routes", () {
    expect(
      PushDeepLinkRouter.resolveRoute({"route": "/neighborhood-watch/alerts"}),
      "/neighborhood-watch/alerts",
    );
  });
}
