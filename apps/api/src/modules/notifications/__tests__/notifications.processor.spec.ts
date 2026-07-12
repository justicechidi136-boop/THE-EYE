import { NOTIFICATIONS_QUEUE_NAME } from "../../../common/queue/queue-names";
import { NotificationsProcessor } from "../notifications.processor";
import { createMetricsMock } from "../../../common/metrics/metrics.test-utils";

describe("NotificationsProcessor", () => {
  it("records successful dispatch attempts", async () => {
    const dispatcher = {
      dispatch: async () => ({
        status: "Delivered" as const,
        provider: "in-app",
        providerMessageId: "in-app-1",
      }),
    };
    const delivery = {
      recordSuccess: jest.fn().mockResolvedValue(undefined),
      recordFailure: jest.fn(),
    };
    const metrics = createMetricsMock();
    const processor = new NotificationsProcessor(dispatcher as never, delivery as never, metrics);

    const result = await processor.process({
      id: "job-1",
      attemptsMade: 0,
      opts: { attempts: 5 },
      data: {
        notificationId: "notification-1",
        channel: "in_app",
        title: "Alert",
        body: "Test",
      },
    } as never);

    expect(result.status).toBe("Delivered");
    expect(metrics.recordNotificationDelivery).toHaveBeenCalled();
    expect(metrics.recordQueueJob).toHaveBeenCalledWith(NOTIFICATIONS_QUEUE_NAME, "completed");
    expect(delivery.recordSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ notificationId: "notification-1" }),
      expect.objectContaining({ provider: "in-app" }),
      1,
    );
  });

  it("records retryable failures and rethrows for BullMQ", async () => {
    const dispatcher = {
      dispatch: async () => {
        throw new Error("temporary provider outage");
      },
    };
    const delivery = {
      recordSuccess: jest.fn(),
      recordFailure: jest.fn().mockResolvedValue(undefined),
    };
    const metrics = createMetricsMock();
    const processor = new NotificationsProcessor(dispatcher as never, delivery as never, metrics);

    let caught: Error | undefined;
    try {
      await processor.process({
        id: "job-2",
        attemptsMade: 1,
        opts: { attempts: 5 },
        data: {
          notificationId: "notification-2",
          channel: "push",
          title: "Alert",
          body: "Test",
        },
      } as never);
    } catch (error) {
      caught = error as Error;
    }

    expect(caught?.message).toBe("temporary provider outage");
    expect(metrics.recordNotificationDelivery).toHaveBeenCalled();
    expect(metrics.recordQueueJob).toHaveBeenCalledWith(NOTIFICATIONS_QUEUE_NAME, "retried");
    expect(delivery.recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({ notificationId: "notification-2" }),
      "temporary provider outage",
      2,
      5,
      false,
      undefined,
    );
  });
});
