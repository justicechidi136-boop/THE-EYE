import { ServiceUnavailableException } from "@nestjs/common";
import { NOTIFICATION_DISPATCH_JOB_NAME } from "../../../common/queue/queue-jobs";
import { createMetricsMock } from "../../../common/metrics/metrics.test-utils";
import { NotificationsService } from "../notifications.service";

function buildService(options: { queue?: { add: jest.Mock; getJob: jest.Mock } | null } = {}) {
  const queue =
    options.queue === null
      ? undefined
      : options.queue ??
        ({
          add: jest.fn().mockResolvedValue({ id: "job-1" }),
          getJob: jest.fn().mockResolvedValue(undefined),
        } as any);
  const config = {
    get: (key: string) => {
      if (key === "THE_EYE_APP_ENV") return "development";
      if (key === "FCM_PROJECT_ID") return "the-eye-29cff";
      return undefined;
    },
  } as any;
  const prisma = {
    notification: {
      create: jest.fn().mockResolvedValue({ id: "notification-1", createdAt: new Date() }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    notificationDeliveryLog: {
      create: jest.fn().mockResolvedValue({ id: "log-1" }),
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ userId: "user-1", distanceMeters: 120 }]),
  } as any;
  return { service: new NotificationsService(queue, prisma, createMetricsMock(), config), queue, prisma };
}

describe("NotificationsService queue enqueue", () => {
  it("returns unavailable in explicit dev disable mode without fake success", async () => {
    const originalDisableRedis = process.env.THE_EYE_DISABLE_REDIS;
    const originalAppEnv = process.env.THE_EYE_APP_ENV;
    process.env.THE_EYE_DISABLE_REDIS = "1";
    process.env.THE_EYE_APP_ENV = "development";
    try {
      const { service } = buildService({ queue: null });
      const result = await service.enqueue({
        notificationId: "notification-1",
        userId: "user-1",
        channel: "push",
        title: "Alert",
        body: "Body",
      });
      expect(result).toEqual({
        jobId: null,
        queued: false,
        status: "Unavailable",
        duplicate: false,
      });
    } finally {
      process.env.THE_EYE_DISABLE_REDIS = originalDisableRedis;
      process.env.THE_EYE_APP_ENV = originalAppEnv;
    }
  });

  it("fails closed when queue is missing outside explicit dev disable", async () => {
    const originalDisableRedis = process.env.THE_EYE_DISABLE_REDIS;
    const originalAppEnv = process.env.THE_EYE_APP_ENV;
    process.env.THE_EYE_DISABLE_REDIS = "0";
    process.env.THE_EYE_APP_ENV = "staging";
    try {
      const { service } = buildService({ queue: null });
      await expect(
        service.enqueue({
          notificationId: "notification-1",
          userId: "user-1",
          channel: "push",
          title: "Alert",
          body: "Body",
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    } finally {
      process.env.THE_EYE_DISABLE_REDIS = originalDisableRedis;
      process.env.THE_EYE_APP_ENV = originalAppEnv;
    }
  });

  it("uses stable job ids and skips duplicate enqueue", async () => {
    const originalDisableRedis = process.env.THE_EYE_DISABLE_REDIS;
    const originalAppEnv = process.env.THE_EYE_APP_ENV;
    process.env.THE_EYE_DISABLE_REDIS = "0";
    process.env.THE_EYE_APP_ENV = "development";
    try {
      const queue = {
        add: jest.fn().mockResolvedValue({ id: "notify:notification-1:push:user-1" }),
        getJob: jest.fn().mockResolvedValue(undefined),
      };
      const { service, queue: queueMock } = buildService({ queue });

      const first = await service.enqueue({
        notificationId: "notification-1",
        userId: "user-1",
        channel: "push",
        title: "Alert",
        body: "Body",
        priority: "Critical",
      });
      expect(first.duplicate).toBe(false);
      expect(queueMock.add).toHaveBeenCalledWith(
        NOTIFICATION_DISPATCH_JOB_NAME,
        expect.objectContaining({
          idempotencyKey: "notify:notification-1:push:user-1",
          recipientUserId: "user-1",
        }),
        expect.objectContaining({ jobId: "notify:notification-1:push:user-1", attempts: 8 }),
      );

      queueMock.getJob.mockResolvedValue({ id: "notify:notification-1:push:user-1", opts: { priority: 1, attempts: 8 } });
      const second = await service.enqueue({
        notificationId: "notification-1",
        userId: "user-1",
        channel: "push",
        title: "Alert",
        body: "Body",
        priority: "Critical",
      });
      expect(second.duplicate).toBe(true);
      expect(queueMock.add).toHaveBeenCalledTimes(1);
    } finally {
      process.env.THE_EYE_DISABLE_REDIS = originalDisableRedis;
      process.env.THE_EYE_APP_ENV = originalAppEnv;
    }
  });
});
