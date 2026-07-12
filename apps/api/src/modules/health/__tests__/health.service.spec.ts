import { createMetricsMock } from "../../../common/metrics/metrics.test-utils";
import { HealthService } from "../health.service";

describe("HealthService", () => {
  it("reports database ok when query succeeds", async () => {
    const prisma = { $queryRaw: async () => [{ "?column?": 1 }] };
    const config = { get: () => undefined };
    const service = new HealthService(prisma as never, config as never, createMetricsMock());
    expect(await service.checkDatabase()).toBe("ok");
  });

  it("reports database error when query fails", async () => {
    const prisma = { $queryRaw: async () => { throw new Error("db down"); } };
    const config = { get: () => undefined };
    const service = new HealthService(prisma as never, config as never, createMetricsMock());
    expect(await service.checkDatabase()).toBe("error");
  });

  it("skips redis when disabled", async () => {
    const previous = process.env.THE_EYE_DISABLE_REDIS;
    process.env.THE_EYE_DISABLE_REDIS = "1";
    const prisma = { $queryRaw: async () => [{ "?column?": 1 }] };
    const config = { get: () => undefined };
    const service = new HealthService(prisma as never, config as never, createMetricsMock());
    expect(await service.checkRedis()).toBe("skipped");
    process.env.THE_EYE_DISABLE_REDIS = previous;
  });
});
