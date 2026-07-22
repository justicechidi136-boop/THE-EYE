import { mapCanonicalDeliveryStatus, mapNotificationInboxItem, sanitizeDeepLink } from "../notification-inbox.mapper";

describe("notification-inbox.mapper", () => {
  it("maps legacy statuses to canonical delivery states", () => {
    expect(
      mapCanonicalDeliveryStatus({
        id: "1",
        type: "EmergencyAlert",
        priority: "Critical",
        channel: "push",
        title: "Alert",
        body: "Body",
        status: "Pending",
        createdAt: new Date(),
        deliveryLogs: [{ status: "Queued" }],
      }),
    ).toBe("Queued");

    expect(
      mapCanonicalDeliveryStatus({
        id: "2",
        type: "IncidentStatusUpdate",
        priority: "Normal",
        channel: "push",
        title: "Sent",
        body: "Body",
        status: "Sent",
        createdAt: new Date(),
      }),
    ).toBe("ProviderAccepted");

    expect(
      mapCanonicalDeliveryStatus({
        id: "3",
        type: "IncidentStatusUpdate",
        priority: "Normal",
        channel: "push",
        title: "Read",
        body: "Body",
        status: "Delivered",
        readAt: new Date(),
        createdAt: new Date(),
      }),
    ).toBe("Read");
  });

  it("sanitizes deep links against the allowlist", () => {
    expect(sanitizeDeepLink("/tracking")).toBe("/tracking");
    expect(sanitizeDeepLink("https://evil.example")).toBe(null);
    expect(sanitizeDeepLink("/../admin")).toBe(null);
  });

  it("returns inbox items without sensitive metadata", () => {
    const item = mapNotificationInboxItem({
      id: "notification-1",
      type: "BroadcastAlert",
      priority: "High",
      channel: "in_app",
      title: "Notice",
      body: "Road closed",
      status: "Delivered",
      createdAt: new Date("2026-07-22T00:00:00.000Z"),
      metadata: { token: "secret", route: "/broadcasts" },
      broadcastId: "broadcast-1",
    });
    expect(item.deepLink).toBe("/broadcasts");
    expect(item.metadata).toEqual({});
  });
});
