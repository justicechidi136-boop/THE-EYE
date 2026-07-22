import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/push/push_deep_link_router.dart";
import "package:the_eye_mobile/push/push_navigation.dart";

void main() {
  test("PushNavigationRequest parses incident deep links", () {
    final request = PushNavigationRequest.fromMessageData({
      "type": "IncidentStatusUpdate",
      "route": "/active-emergency",
      "incidentId": "inc-123",
      "silent": "true",
    });
    expect(request?.route, "/active-emergency");
    expect(request?.incidentId, "inc-123");
    expect(request?.silent, isTrue);
  });

  test("PushNavigationRequest rejects unsafe routes", () {
    expect(
      PushNavigationRequest.fromMessageData({"route": "https://evil.example"}),
      isNull,
    );
  });

  test("incident status notifications resolve to active emergency route", () {
    expect(
      PushDeepLinkRouter.resolveRoute({"type": "IncidentStatusUpdate", "incidentId": "inc-1"}),
      "/active-emergency",
    );
  });
}
