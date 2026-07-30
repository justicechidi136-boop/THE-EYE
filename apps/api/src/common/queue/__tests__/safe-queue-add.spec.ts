import type { Queue } from "bullmq";
import { safeQueueAdd } from "../safe-queue-add";
import { BullQueueEnqueueError } from "../bull-job-id";

describe("safeQueueAdd", () => {
  it("rejects invalid job ids before calling BullMQ", async () => {
    const queue = { name: "notifications", add: jest.fn() } as unknown as Queue;
    await expect(
      safeQueueAdd(queue, "dispatch", { title: "x" }, { jobId: "notify:bad:id" }),
    ).rejects.toBeInstanceOf(BullQueueEnqueueError);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("wraps BullMQ enqueue failures with structured context", async () => {
    const queue = {
      name: "notifications",
      add: jest.fn().mockRejectedValue(new Error("Custom Id cannot contain :")),
    } as unknown as Queue;

    await expect(
      safeQueueAdd(
        queue,
        "dispatch",
        { title: "Emergency" },
        { jobId: "notify-notification-1-push-user-1" },
        { incidentId: "incident-1" },
      ),
    ).rejects.toMatchObject({
      message: "Custom Id cannot contain :",
      context: expect.objectContaining({
        queueName: "notifications",
        incidentId: "incident-1",
        jobId: "notify-notification-1-push-user-1",
      }),
    });
  });
});
