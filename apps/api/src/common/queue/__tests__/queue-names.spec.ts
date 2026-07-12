import { resolveNotificationsQueueName } from "../queue-names";

describe("queue-names", () => {
  it("isolates staging and production push queues", () => {
    expect(resolveNotificationsQueueName("staging")).toBe("the-eye-staging-push");
    expect(resolveNotificationsQueueName("production")).toBe("the-eye-production-push");
    expect(resolveNotificationsQueueName("development")).toBe("the-eye-development-push");
  });
});
