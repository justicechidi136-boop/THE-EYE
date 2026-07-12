import { MetricsController } from "../metrics.controller";
import { MetricsService } from "../metrics.service";

describe("metrics controller", () => {
  it("returns Prometheus exposition format", async () => {
    const previousToken = process.env.METRICS_BEARER_TOKEN;
    delete process.env.METRICS_BEARER_TOKEN;
    try {
      const metrics = {
        contentType: "text/plain; version=0.0.4; charset=utf-8",
        renderMetrics: jest.fn().mockResolvedValue("# HELP the_eye_http_requests_total\n"),
      } as unknown as MetricsService;
      const controller = new MetricsController(metrics);
      const response = {
        setHeader: jest.fn(),
        send: jest.fn(),
        status(code: number) {
          return this;
        },
      };

      await controller.scrape({ headers: {} }, response as never);

      expect(response.setHeader).toHaveBeenCalledWith("Content-Type", metrics.contentType);
      expect(response.send).toHaveBeenCalledWith("# HELP the_eye_http_requests_total\n");
    } finally {
      if (previousToken === undefined) delete process.env.METRICS_BEARER_TOKEN;
      else process.env.METRICS_BEARER_TOKEN = previousToken;
    }
  });

  it("rejects unauthenticated scrape requests when a bearer token is configured", async () => {
    process.env.METRICS_BEARER_TOKEN = "metrics-secret-token";
    const metrics = {
      contentType: "text/plain; version=0.0.4; charset=utf-8",
      renderMetrics: jest.fn(),
    } as unknown as MetricsService;
    const controller = new MetricsController(metrics);
    let statusCode = 200;
    const response = {
      setHeader: jest.fn(),
      send: jest.fn(),
      status(code: number) {
        statusCode = code;
        return this;
      },
    };

    await controller.scrape({ headers: {} }, response as never);

    expect(statusCode).toBe(401);
    expect(response.send).toHaveBeenCalledWith("Unauthorized");
    expect(metrics.renderMetrics).not.toHaveBeenCalled();
    delete process.env.METRICS_BEARER_TOKEN;
  });
});
