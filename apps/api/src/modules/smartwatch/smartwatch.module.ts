import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/auth/optional-jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { DangerZonesModule } from "../danger-zones/danger-zones.module";
import { DangerTriggerModule } from "../danger-trigger/danger-trigger.module";
import { IncidentsModule } from "../incidents/incidents.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SmartwatchController } from "./smartwatch.controller";
import { DevicesWatchController } from "./devices-watch.controller";
import { AdminWatchNotificationsController } from "./admin-watch-notifications.controller";
import { SmartwatchService } from "./smartwatch.service";

@Module({
  imports: [ConfigModule, PrismaModule, AuditModule, IncidentsModule, NotificationsModule, DangerZonesModule, DangerTriggerModule],
  controllers: [SmartwatchController, DevicesWatchController, AdminWatchNotificationsController],
  providers: [SmartwatchService, JwtAuthGuard, OptionalJwtAuthGuard, PermissionsGuard],
})
export class SmartwatchModule {}
