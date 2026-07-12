import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { RateLimitModule } from "../rate-limit.module";
import { RateLimitService } from "../rate-limit.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), RateLimitModule],
})
class RateLimitDiTestModule {}

describe("RateLimitService DI", () => {
  it("resolves through Nest application context", async () => {
    const app = await NestFactory.createApplicationContext(RateLimitDiTestModule, { logger: false });
    try {
      const service = app.get(RateLimitService);
      expect(service).toBeInstanceOf(RateLimitService);
      const result = await service.consume("di-test-key", 5, 60, "ip");
      expect(result.limit).toBe(5);
    } finally {
      await app.close();
    }
  });
});
