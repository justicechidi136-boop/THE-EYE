import { Global, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { Registry } from "prom-client";
import { GlobalExceptionFilter } from "../filters/http-exception.filter";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";
import { PROMETHEUS_REGISTRY } from "./prometheus-registry.token";

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    {
      provide: PROMETHEUS_REGISTRY,
      useFactory: () => new Registry(),
    },
    MetricsService,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
  exports: [MetricsService, PROMETHEUS_REGISTRY],
})
export class MetricsModule {}
