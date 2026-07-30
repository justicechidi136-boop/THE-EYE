import {
  buildBroadcastAutoDispatchJobId,
  buildDangerZoneActivateJobId,
  buildNotificationDispatchJobId,
  buildNotificationIdempotencyKey,
  NOTIFICATION_DISPATCH_JOB_NAME,
} from "../queue-jobs";

describe("queue-jobs", () => {
  it("uses stable colon-free dispatch job ids", () => {
    const payload = {
      notificationId: "notification-1",
      channel: "push",
      userId: "user-1",
    };
    expect(buildNotificationDispatchJobId(payload)).toBe("notify-notification-1-push-user-1");
    expect(buildNotificationIdempotencyKey(payload)).toBe(buildNotificationDispatchJobId(payload));
    expect(NOTIFICATION_DISPATCH_JOB_NAME).toBe("dispatch");
  });

  it("includes phone recipient for sms emergency contact dispatches", () => {
    expect(
      buildNotificationDispatchJobId({
        notificationId: "notification-1",
        channel: "sms",
        phone: "+2348012345678",
      }),
    ).toBe("notify-notification-1-sms-+2348012345678");
  });

  it("uses stable broadcast auto-dispatch ids", () => {
    expect(buildBroadcastAutoDispatchJobId("broadcast-1")).toBe("broadcast-auto-dispatch-broadcast-1");
  });

  it("uses stable danger zone activation ids", () => {
    expect(buildDangerZoneActivateJobId("zone-1")).toBe("danger-zone-activate-zone-1");
  });
});
