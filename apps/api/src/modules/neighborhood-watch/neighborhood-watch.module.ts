import { Module } from "@nestjs/common";
import { createStorageDownloadUrl } from "../../common/storage/s3-presign";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { BroadcastsModule } from "../broadcasts/broadcasts.module";
import { DangerZonesModule } from "../danger-zones/danger-zones.module";
import { IncidentsModule } from "../incidents/incidents.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { NeighborhoodWatchController } from "./neighborhood-watch.controller";
import {
  NEIGHBORHOOD_WATCH_SIGN_DOWNLOAD_URL,
  NeighborhoodWatchService,
} from "./neighborhood-watch.service";
import { NeighborhoodWatchContextService } from "./neighborhood-watch-context.service";
import { AiIntelligenceService } from "./ai-intelligence.service";

@Module({
  imports: [PrismaModule, AuditModule, IncidentsModule, BroadcastsModule, NotificationsModule, DangerZonesModule],
  controllers: [NeighborhoodWatchController],
  providers: [
    NeighborhoodWatchService,
    NeighborhoodWatchContextService,
    AiIntelligenceService,
    {
      provide: NEIGHBORHOOD_WATCH_SIGN_DOWNLOAD_URL,
      useValue: createStorageDownloadUrl,
    },
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [NeighborhoodWatchService, NeighborhoodWatchContextService, AiIntelligenceService],
})
export class NeighborhoodWatchModule {}
