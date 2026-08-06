import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/push/notification_routing.dart";
import "package:the_eye_mobile/push/push_navigation.dart";

void main() {
  test("schema v1 routes active incident notifications to active emergency",
      () {
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

  test("schema v1 routes broadcast notifications to broadcast detail", () {
    final route = PushNotificationRouting.fromMessageData({
      "schemaVersion": "1",
      "routeType": "BROADCAST_DETAILS",
      "destination": "/broadcasts/broadcast-1",
      "broadcastId": "broadcast-1",
      "eventType": "MISSING_PERSON_FOUND",
      "status": "Resolved",
    });
    expect(route?.routeType, "BROADCAST_DETAILS");
    expect(route?.broadcastId, "broadcast-1");
    expect(route?.opensBroadcastDetails, isTrue);
    expect(route?.destination, "/broadcasts/broadcast-1");
  });

  test("PushNavigationRequest resolves BROADCAST_DETAILS deep links", () {
    final request = PushNavigationRequest.fromMessageData({
      "schemaVersion": "1",
      "routeType": "BROADCAST_DETAILS",
      "deepLink": "/broadcasts/broadcast-9",
      "broadcastId": "broadcast-9",
      "eventType": "BROADCAST_WITHDRAWN",
      "status": "WithdrawnByAuthor",
    });
    expect(request?.route, "/broadcasts/broadcast-9");
    expect(request?.routing?.opensBroadcastDetails, isTrue);
  });

  test("allows incident message thread deep links", () {
    final request = PushNavigationRequest.fromMessageData({
      "schemaVersion": "1",
      "routeType": "OWN_ACTIVE_INCIDENT",
      "eventType": "INCIDENT_MESSAGE_RECEIVED",
      "destination": "/active-emergency/inc-123/messages",
      "incidentId": "inc-123",
      "messageId": "msg-1",
      "notificationType": "IncidentMessageReceived",
    });
    expect(request?.route, "/active-emergency/inc-123/messages");
    expect(request?.incidentId, "inc-123");
  });
}
