import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { WATCH_FLEET_BULK_QUEUE_NAME, WATCH_FLEET_EXPORT_QUEUE_NAME } from "../../common/queue/queue-names";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { WatchBulkService } from "./watch-bulk.service";
import { WatchExportCleanupService } from "./watch-export-cleanup.service";
import { WatchExportMetrics } from "./watch-export-metrics";
import { WatchExportService } from "./watch-export.service";
import { WatchFleetBulkProcessor } from "./watch-fleet-bulk.processor";
import { WatchFleetExportProcessor } from "./watch-fleet-export.processor";
import { WatchFleetStatsRepository } from "./watch-fleet-stats.repository";
import { WatchOwnershipService } from "./watch-ownership.service";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    ...(shouldRegisterBullMq()
      ? [
          BullModule.registerQueue({ name: WATCH_FLEET_BULK_QUEUE_NAME }),
          BullModule.registerQueue({ name: WATCH_FLEET_EXPORT_QUEUE_NAME }),
        ]
      : []),
  ],
  providers: [
    WatchFleetStatsRepository,
    WatchOwnershipService,
    WatchBulkService,
    WatchExportMetrics,
    WatchExportService,
    WatchExportCleanupService,
    ...(shouldRegisterBullMq() ? [WatchFleetBulkProcessor, WatchFleetExportProcessor] : []),
  ],
  exports: [WatchExportService, WatchExportCleanupService],
})
export class WatchFleetWorkerModule {}
