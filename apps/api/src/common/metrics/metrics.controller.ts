import { Controller, Get, Header, Req, Res, UnauthorizedException } from "@nestjs/common";
import { MetricsService } from "./metrics.service";

type MetricsResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): MetricsResponse;
  send(body: string): void;
};

@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get("metrics")
  @Header("Cache-Control", "no-store")
  async scrape(@Req() request: { headers?: Record<string, string | string[] | undefined> }, @Res() response: MetricsResponse) {
    const expected = process.env.METRICS_BEARER_TOKEN;
    if (expected) {
      const header = request.headers?.authorization;
      const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : undefined;
      if (!token || token !== expected) {
        response.status(401).send("Unauthorized");
        return;
      }
    } else if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("Metrics endpoint is disabled without METRICS_BEARER_TOKEN");
    }

    response.setHeader("Content-Type", this.metrics.contentType);
    response.send(await this.metrics.renderMetrics());
  }
}
