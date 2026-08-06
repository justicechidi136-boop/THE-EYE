import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/push/notification_routing.dart";
import "package:the_eye_mobile/push/push_deep_link_router.dart";
import "package:the_eye_mobile/push/push_navigation.dart";

void main() {
  test("schema v1 routes community verification by requestId", () {
    final route = PushNotificationRouting.fromMessageData({
      "schemaVersion": "1",
      "routeType": "COMMUNITY_VERIFICATION",
      "destination": "/community-verification/req-123",
      "verificationRequestId": "req-123",
      "eventType": "NEARBY_INCIDENT_VERIFICATION",
      "incidentId": "inc-999",
    });
    expect(route?.opensCommunityVerification, isTrue);
    expect(route?.destination, "/community-verification/req-123");
    expect(route?.opensActiveEmergency, isFalse);
  });

  test("PushNavigationRequest accepts community verification destination", () {
    final request = PushNavigationRequest.fromMessageData({
      "schemaVersion": "1",
      "routeType": "COMMUNITY_VERIFICATION",
      "destination": "/community-verification/req-42",
      "verificationRequestId": "req-42",
      "notificationType": "NearbyIncidentVerification",
    });
    expect(request?.route, "/community-verification/req-42");
    expect(PushDeepLinkRouter.isAllowedDestination(request!.route), isTrue);
  });

  test("legacy incident type alone does not open active emergency when verificationRequestId exists", () {
    final route = PushDeepLinkRouter.resolveRoute({
      "type": "incident",
      "verificationRequestId": "req-55",
    });
    expect(route, "/community-verification/req-55");
  });
}
