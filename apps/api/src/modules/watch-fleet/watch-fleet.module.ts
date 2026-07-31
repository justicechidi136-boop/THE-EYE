import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { WATCH_FLEET_BULK_QUEUE_NAME } from "../../common/queue/queue-names";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { WatchBulkService } from "./watch-bulk.service";
import { WatchFleetBulkProcessor } from "./watch-fleet-bulk.processor";
import { WatchFleetController } from "./watch-fleet.controller";
import { WatchFleetService } from "./watch-fleet.service";
import { WatchOwnershipService } from "./watch-ownership.service";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    ...(shouldRegisterBullMq() ? [BullModule.registerQueue({ name: WATCH_FLEET_BULK_QUEUE_NAME })] : []),
  ],
  controllers: [WatchFleetController],
  providers: [
    WatchFleetService,
    WatchOwnershipService,
    WatchBulkService,
    ...(shouldRegisterBullMq() ? [WatchFleetBulkProcessor] : []),
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [WatchFleetService, WatchOwnershipService, WatchBulkService],
})
export class WatchFleetModule {}
