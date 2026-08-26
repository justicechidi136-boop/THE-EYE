import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { IncidentsModule } from "../incidents/incidents.module";
import { LiveVideoModule } from "../live-video/live-video.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { DangerTriggerController } from "./danger-trigger.controller";
import { DangerTriggerService } from "./danger-trigger.service";

@Module({
  imports: [ConfigModule, PrismaModule, AuditModule, IncidentsModule, LiveVideoModule, NotificationsModule],
  controllers: [DangerTriggerController],
  providers: [DangerTriggerService, JwtAuthGuard, PermissionsGuard],
  exports: [DangerTriggerService],
})
export class DangerTriggerModule {}
