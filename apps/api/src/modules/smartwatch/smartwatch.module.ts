import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/auth/optional-jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { IncidentsModule } from "../incidents/incidents.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SmartwatchController } from "./smartwatch.controller";
import { SmartwatchService } from "./smartwatch.service";

@Module({
  imports: [ConfigModule, PrismaModule, AuditModule, IncidentsModule, NotificationsModule],
  controllers: [SmartwatchController],
  providers: [SmartwatchService, JwtAuthGuard, OptionalJwtAuthGuard, PermissionsGuard],
})
export class SmartwatchModule {}
