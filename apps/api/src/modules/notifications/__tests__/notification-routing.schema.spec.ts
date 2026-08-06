import {
  NOTIFICATION_SCHEMA_VERSION,
  buildIncidentMessageNotificationMetadata,
  resolveReporterNotificationRouting,
} from "../notification-routing.schema";
import { sanitizeDeepLink } from "../notification-inbox.mapper";

describe("notification-routing.schema", () => {
  it("routes active incidents to active emergency", () => {
    const routing = resolveReporterNotificationRouting({
      incidentId: "inc-1",
      status: "Responding",
      notificationType: "IncidentStatusUpdate",
    });
    expect(routing.schemaVersion).toBe(NOTIFICATION_SCHEMA_VERSION);
    expect(routing.routeType).toBe("OWN_ACTIVE_INCIDENT");
    expect(routing.destination).toBe("/active-emergency");
  });

  it("routes terminal incidents to incident details", () => {
    const routing = resolveReporterNotificationRouting({
      incidentId: "inc-2",
      status: "Resolved",
      notificationType: "IncidentStatusUpdate",
    });
    expect(routing.routeType).toBe("OWN_INCIDENT_DETAILS");
    expect(routing.destination).toBe("/incident-detail");
  });

  it("builds incident message deep link without content", () => {
    const metadata = buildIncidentMessageNotificationMetadata({
      incidentId: "inc-3",
      status: "Responding",
      messageId: "msg-1",
      notificationType: "IncidentMessageReceived",
    });
    expect(metadata.eventType).toBe("INCIDENT_MESSAGE_RECEIVED");
    expect(metadata.deepLink).toBe("/active-emergency/inc-3/messages");
    expect(metadata.body).toBeUndefined();
    expect(sanitizeDeepLink(metadata.deepLink as string)).toBe("/active-emergency/inc-3/messages");
  });
});
