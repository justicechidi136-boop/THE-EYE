import { Module } from "@nestjs/common";
import { IncidentScopeGuard } from "../../common/auth/incident-scope.guard";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/auth/optional-jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { VerificationModule } from "../verification/verification.module";
import { IncidentsController } from "./incidents.controller";
import { IncidentsService } from "./incidents.service";

@Module({
  imports: [AuditModule, NotificationsModule, PrismaModule, VerificationModule],
  controllers: [IncidentsController],
  providers: [IncidentsService, JwtAuthGuard, OptionalJwtAuthGuard, PermissionsGuard, IncidentScopeGuard],
  exports: [IncidentsService],
})
export class IncidentsModule {}
