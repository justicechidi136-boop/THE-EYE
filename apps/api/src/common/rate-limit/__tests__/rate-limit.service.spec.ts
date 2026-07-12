import { ConfigService } from "@nestjs/config";
import { RateLimitService } from "../rate-limit.service";

describe("RateLimitService", () => {
  it("blocks requests after the configured limit in memory mode", async () => {
    const previous = process.env.THE_EYE_DISABLE_REDIS;
    process.env.THE_EYE_DISABLE_REDIS = "1";
    const service = new RateLimitService({ get: () => undefined } as unknown as ConfigService);

    const first = await service.consume("test-key", 2, 60, "ip");
    const second = await service.consume("test-key", 2, 60, "ip");
    const third = await service.consume("test-key", 2, 60, "ip");

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.count).toBe(3);

    process.env.THE_EYE_DISABLE_REDIS = previous;
  });
});
