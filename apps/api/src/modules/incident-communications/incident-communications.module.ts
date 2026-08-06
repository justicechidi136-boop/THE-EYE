import { Module } from "@nestjs/common";
import { IncidentScopeGuard } from "../../common/auth/incident-scope.guard";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { IncidentCommunicationsAccessService } from "./incident-communications-access.service";
import { IncidentCommunicationsController } from "./incident-communications.controller";
import { IncidentCommunicationsService } from "./incident-communications.service";

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [IncidentCommunicationsController],
  providers: [
    IncidentCommunicationsService,
    IncidentCommunicationsAccessService,
    JwtAuthGuard,
    PermissionsGuard,
    IncidentScopeGuard,
  ],
  exports: [IncidentCommunicationsService, IncidentCommunicationsAccessService],
})
export class IncidentCommunicationsModule {}
