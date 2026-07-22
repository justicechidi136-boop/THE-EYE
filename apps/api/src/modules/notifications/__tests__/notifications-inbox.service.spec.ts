import { NotificationsService } from "../notifications.service";

function buildInboxService() {
  const prisma = {
    notification: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "notification-1",
          userId: "user-1",
          type: "BroadcastAlert",
          priority: "High",
          channel: "in_app",
          title: "Notice",
          body: "Body",
          status: "Delivered",
          createdAt: new Date("2026-07-22T00:00:00.000Z"),
          readAt: null,
          metadata: {},
          deliveryLogs: [],
        },
      ]),
      findFirst: jest.fn().mockResolvedValue({
        id: "notification-1",
        userId: "user-1",
        type: "BroadcastAlert",
        priority: "High",
        channel: "in_app",
        title: "Notice",
        body: "Body",
        status: "Delivered",
        createdAt: new Date("2026-07-22T00:00:00.000Z"),
        readAt: null,
        metadata: {},
        deliveryLogs: [],
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(1),
    },
  } as any;
  const service = new NotificationsService(undefined, prisma, { recordRedisOperation: jest.fn() } as any, {
    get: () => undefined,
  } as any);
  return { service, prisma };
}

describe("NotificationsService inbox", () => {
  it("scopes list results to the current user and returns unread count", async () => {
    const { service, prisma } = buildInboxService();
    const page = await service.listForActor({ typ: "user", sub: "user-1" } as any);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      }),
    );
    expect(page.meta.unreadCount).toBe(1);
    expect(page.data[0].deliveryStatus).toBe("Delivered");
  });

  it("marks read idempotently and returns unread count", async () => {
    const { service, prisma } = buildInboxService();
    prisma.notification.count.mockResolvedValue(0);
    const result = await service.markRead("notification-1", { typ: "user", sub: "user-1" } as any);
    expect(result.updated).toBe(1);
    expect(result.unreadCount).toBe(0);
    expect(prisma.notification.updateMany).toHaveBeenCalled();
  });

  it("marks all read for the actor", async () => {
    const { service, prisma } = buildInboxService();
    const result = await service.markAllRead({ typ: "user", sub: "user-1" } as any);
    expect(result.updated).toBe(1);
    expect(result.unreadCount).toBe(0);
  });
});
