import {
  buildNotificationDispatchJobId,
  buildNotificationIdempotencyKey,
  NOTIFICATION_DISPATCH_JOB_NAME,
} from "../queue-jobs";

describe("queue-jobs", () => {
  it("uses stable dispatch job ids", () => {
    const payload = {
      notificationId: "notification-1",
      channel: "push",
      userId: "user-1",
    };
    expect(buildNotificationDispatchJobId(payload)).toBe("notify:notification-1:push:user-1");
    expect(buildNotificationIdempotencyKey(payload)).toBe(buildNotificationDispatchJobId(payload));
    expect(NOTIFICATION_DISPATCH_JOB_NAME).toBe("dispatch");
  });
});
