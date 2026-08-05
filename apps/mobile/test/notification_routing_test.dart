import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/push/notification_routing.dart";
import "package:the_eye_mobile/push/push_navigation.dart";

void main() {
  test("schema v1 routes active incident notifications to active emergency", () {
    final request = PushNavigationRequest.fromMessageData({
      "schemaVersion": "1",
      "routeType": "OWN_ACTIVE_INCIDENT",
      "destination": "/active-emergency",
      "incidentId": "inc-123",
      "notificationType": "IncidentStatusUpdate",
      "status": "Responding",
    });
    expect(request?.route, "/active-emergency");
    expect(request?.incidentId, "inc-123");
    expect(request?.routing?.routeType, "OWN_ACTIVE_INCIDENT");
  });

  test("schema v1 routes resolved incidents to incident details", () {
    final request = PushNavigationRequest.fromMessageData({
      "schemaVersion": "1",
      "routeType": "OWN_INCIDENT_DETAILS",
      "destination": "/incident-detail",
      "incidentId": "inc-456",
      "notificationType": "IncidentStatusUpdate",
      "status": "Resolved",
    });
    expect(request?.route, "/incident-detail");
    expect(request?.routing?.opensIncidentDetails, isTrue);
  });
}
