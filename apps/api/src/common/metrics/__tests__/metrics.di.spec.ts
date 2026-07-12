import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Registry } from "prom-client";
import { MetricsModule } from "../metrics.module";
import { MetricsService } from "../metrics.service";
import { PROMETHEUS_REGISTRY } from "../prometheus-registry.token";

@Module({
  imports: [MetricsModule],
})
class MetricsDiTestModule {}

describe("MetricsService DI", () => {
  it("resolves MetricsService and shared Prometheus registry", async () => {
    const app = await NestFactory.createApplicationContext(MetricsDiTestModule, { logger: false });
    try {
      const metrics = app.get(MetricsService);
      const registry = app.get<Registry>(PROMETHEUS_REGISTRY);
      expect(metrics).toBeInstanceOf(MetricsService);
      expect(registry).toBeInstanceOf(Registry);
      const rendered = await metrics.renderMetrics();
      expect(rendered).toContain("the_eye_http_request_duration_seconds");
    } finally {
      await app.close();
    }
  });
});
