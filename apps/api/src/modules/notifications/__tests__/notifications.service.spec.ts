import { NOTIFICATION_DISPATCH_JOB_NAME } from "../../../common/queue/queue-jobs";
import { createMetricsMock } from "../../../common/metrics/metrics.test-utils";
import { NotificationsService } from "../notifications.service";

function buildService() {
  const queue = { add: jest.fn().mockResolvedValue({ id: "job-1" }), getJob: jest.fn().mockResolvedValue(undefined) } as any;
  const config = {
    get: (key: string) => {
      if (key === "THE_EYE_APP_ENV") return "development";
      if (key === "FCM_PROJECT_ID") return "the-eye-29cff";
      return undefined;
    },
  } as any;
  const prisma = {
    notification: {
      create: jest.fn().mockResolvedValue({ id: "notification-1" }),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    notificationDeliveryLog: {
      create: jest.fn().mockResolvedValue({ id: "log-1" }),
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ userId: "user-1", distanceMeters: 120 }]),
  } as any;
  return { service: new NotificationsService(queue, prisma, createMetricsMock(), config), queue, prisma };
}

describe("NotificationsService", () => {
  it("creates location-targeted push and in-app notifications", async () => {
    const { service, prisma, queue } = buildService();
    const result = await service.create({
      type: "NearbyDangerWarning",
      title: "Danger nearby",
      body: "Avoid Allen Avenue",
      latitude: 6.6012,
      longitude: 3.3514,
      radiusMeters: 5000,
    });

    expect(result.recipientCount).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenCalledWith(
      NOTIFICATION_DISPATCH_JOB_NAME,
      expect.objectContaining({ priority: "Critical", idempotencyKey: "notify:notification-1:push:user-1" }),
      expect.objectContaining({ priority: 1, attempts: 8, jobId: "notify:notification-1:push:user-1" }),
    );
    expect(prisma.notificationDeliveryLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "Queued", attempt: 0 }),
    }));
  });

  it("marks a notification read for the current actor", async () => {
    const { service, prisma } = buildService();
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    const result = await service.markRead("notification-1", { typ: "user", sub: "user-1" } as any);
    expect(result.updated).toBe(1);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "Read" }),
    }));
  });
});
