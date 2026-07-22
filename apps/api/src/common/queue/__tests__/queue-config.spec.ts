import {
  isProductionLikeAppEnvironment,
  isRedisExplicitlyDisabled,
  resolveBullMqRootOptions,
  resolveQueuePrefix,
  shouldRegisterNotificationWorker,
} from "../queue-config";

describe("queue-config", () => {
  it("detects explicit redis disable only in development", () => {
    expect(isRedisExplicitlyDisabled({ THE_EYE_DISABLE_REDIS: "1", THE_EYE_APP_ENV: "development" })).toBe(true);
    expect(isProductionLikeAppEnvironment({ THE_EYE_APP_ENV: "staging" })).toBe(true);
    expect(isProductionLikeAppEnvironment({ THE_EYE_APP_ENV: "development" })).toBe(false);
  });

  it("builds shared redis and bullmq prefix settings", () => {
    const config = {
      THE_EYE_APP_ENV: "staging",
      REDIS_HOST: "redis",
      REDIS_PORT: 6379,
      REDIS_PASSWORD: "secret",
      REDIS_DB: 2,
    };
    expect(resolveQueuePrefix(config)).toBe("the-eye-staging");
    expect(resolveBullMqRootOptions(config)).toEqual({
      connection: {
        host: "redis",
        port: 6379,
        password: "secret",
        db: 2,
        maxRetriesPerRequest: null,
      },
      prefix: "the-eye-staging",
    });
  });

  it("registers worker only when explicitly enabled", () => {
    expect(shouldRegisterNotificationWorker({ THE_EYE_RUN_NOTIFICATION_WORKER: "1" })).toBe(true);
    expect(shouldRegisterNotificationWorker({})).toBe(false);
  });
});
