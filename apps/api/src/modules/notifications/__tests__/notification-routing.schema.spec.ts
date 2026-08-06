import {
  NOTIFICATION_SCHEMA_VERSION,
  resolveReporterNotificationRouting,
} from "../notification-routing.schema";

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
});
