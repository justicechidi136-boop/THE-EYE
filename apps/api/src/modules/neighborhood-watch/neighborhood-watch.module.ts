import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { BroadcastsModule } from "../broadcasts/broadcasts.module";
import { IncidentsModule } from "../incidents/incidents.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { NeighborhoodWatchController } from "./neighborhood-watch.controller";
import { NeighborhoodWatchService } from "./neighborhood-watch.service";

@Module({
  imports: [PrismaModule, AuditModule, IncidentsModule, BroadcastsModule, NotificationsModule],
  controllers: [NeighborhoodWatchController],
  providers: [NeighborhoodWatchService, JwtAuthGuard, PermissionsGuard],
  exports: [NeighborhoodWatchService],
})
export class NeighborhoodWatchModule {}
