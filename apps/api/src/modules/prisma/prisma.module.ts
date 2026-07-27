import { Global, Module } from "@nestjs/common";
import { MetricsService } from "../../common/metrics/metrics.service";
import { createPrismaService, PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: (metrics?: MetricsService) => createPrismaService(metrics),
      inject: [{ token: MetricsService, optional: true }],
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
