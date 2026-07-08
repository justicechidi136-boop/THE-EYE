import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { BroadcastsController } from "./broadcasts.controller";
import { BroadcastsService } from "./broadcasts.service";

@Module({
  imports: [PrismaModule, NotificationsModule, AuditModule],
  controllers: [BroadcastsController],
  providers: [BroadcastsService, JwtAuthGuard, PermissionsGuard],
  exports: [BroadcastsService],
})
export class BroadcastsModule {}
