import { NotificationsService } from "../notifications.service";

function buildAckService() {
  const deliveryLogs: Array<Record<string, unknown>> = [];
  const prisma = {
    notification: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    broadcastDelivery: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    userPushToken: {
      upsert: jest.fn(),
    },
    notificationDeliveryLog: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        deliveryLogs.push(data);
        return data;
      }),
    },
  } as any;

  const service = new NotificationsService(undefined, prisma, { recordRedisOperation: jest.fn() } as any, {
    get: (key: string) => (key === "THE_EYE_APP_ENV" ? "staging" : undefined),
  } as any);

  return { service, prisma, deliveryLogs };
}

describe("NotificationsService device receipt security", () => {
  it("rejects acknowledgement for another user's notification", async () => {
    const { service, prisma } = buildAckService();
    prisma.notification.findFirst.mockResolvedValue(null);

    let caught: Error | undefined;
    try {
      await service.recordDeviceReceived("notification-1", { typ: "user", sub: "user-2" } as any);
    } catch (error) {
      caught = error as Error;
    }

    expect(caught?.message).toContain("Notification not found");
    expect(prisma.notificationDeliveryLog.create).not.toHaveBeenCalled();
  });

  it("is idempotent when device receipt was already recorded", async () => {
    const { service, prisma, deliveryLogs } = buildAckService();
    prisma.notification.findFirst.mockResolvedValue({
      id: "notification-1",
      userId: "user-1",
      channel: "push",
      provider: "firebase-cloud-messaging",
      status: "Delivered",
      metadata: { deviceReceivedAt: "2026-07-22T00:00:00.000Z" },
    });

    const result = await service.recordDeviceReceived("notification-1", { typ: "user", sub: "user-1" } as any, "opened");
    expect(result.duplicate).toBe(true);
    expect(deliveryLogs.length).toBe(0);
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it("rejects cross-environment push token registration", async () => {
    const { service } = buildAckService();
    let caught: Error | undefined;
    try {
      await service.registerPushToken(
        { token: "abc", platform: "android", appEnvironment: "production" },
        { typ: "user", sub: "user-1" } as any,
      );
    } catch (error) {
      caught = error as Error;
    }
    expect(caught?.message).toContain("staging");
  });
});
