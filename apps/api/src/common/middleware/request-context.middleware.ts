import { randomUUID } from "crypto";
import { Injectable, NestMiddleware, Optional, Inject } from "@nestjs/common";
import { MetricsService } from "../metrics/metrics.service";

type HttpRequest = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  method: string;
  originalUrl: string;
};

type HttpResponse = {
  setHeader(name: string, value: string): void;
  statusCode: number;
  on(event: "finish", listener: () => void): void;
};

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(@Optional() @Inject(MetricsService) private readonly metrics?: MetricsService) {}

  use(req: HttpRequest, res: HttpResponse, next: () => void) {
    const requestId = String(req.headers["x-request-id"] ?? randomUUID());
    req.headers["x-request-id"] = requestId;
    res.setHeader("X-Request-ID", requestId);

    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      this.metrics?.recordHttpRequest(req.method, req.originalUrl, res.statusCode, durationSeconds);
      console.log(
        JSON.stringify({
          level: "info",
          requestId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Math.round(durationSeconds * 1000),
          ip: req.ip,
        }),
      );
    });

    next();
  }
}
