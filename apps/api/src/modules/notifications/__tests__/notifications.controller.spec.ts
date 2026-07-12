import { NotificationsController } from "../notifications.controller";

describe("NotificationsController integration", () => {
  it("creates a targeted notification through the API controller", async () => {
    const service = {
      create: jest.fn().mockResolvedValue({ data: [{ id: "notification-1" }], recipientCount: 1, channelCount: 2 }),
      listForActor: jest.fn(),
      registerPushToken: jest.fn(),
      deactivatePushToken: jest.fn(),
      markRead: jest.fn(),
      markUnread: jest.fn(),
      deliveryLogs: jest.fn(),
      recordDelivery: jest.fn(),
    } as any;
    const controller = new NotificationsController(service);

    const result = await controller.send(
      {
        type: "EmergencyAlert",
        title: "Emergency nearby",
        body: "Avoid Allen Avenue",
        latitude: 6.6012,
        longitude: 3.3514,
        radiusMeters: 5000,
        channels: ["push", "in_app"],
      },
      { user: { typ: "admin", sub: "admin-1", role: "Super Admin" } },
    );

    expect(result.recipientCount).toBe(1);
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "EmergencyAlert" }),
      { typ: "admin", sub: "admin-1", role: "Super Admin" },
    );
  });

  it("lists unread notifications for the actor", async () => {
    const service = { listForActor: jest.fn().mockResolvedValue({ data: [] }) } as any;
    const controller = new NotificationsController(service);

    await controller.list({ user: { typ: "user", sub: "user-1" } }, "true");
    expect(service.listForActor).toHaveBeenCalledWith(
      { typ: "user", sub: "user-1" },
      true,
      { cursor: undefined, limit: undefined },
    );
  });
});
