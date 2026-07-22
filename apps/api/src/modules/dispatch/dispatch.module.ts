import { Module } from "@nestjs/common";
import { IncidentScopeGuard } from "../../common/auth/incident-scope.guard";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AgencyRoutingService } from "./agency-routing.service";
import { DispatchController } from "./dispatch.controller";
import { DispatchService } from "./dispatch.service";
import { EmergencyClassificationService } from "./emergency-classification.service";
import { TriageService } from "./triage.service";

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [DispatchController],
  providers: [
    DispatchService,
    TriageService,
    AgencyRoutingService,
    EmergencyClassificationService,
    JwtAuthGuard,
    PermissionsGuard,
    IncidentScopeGuard,
  ],
  exports: [DispatchService, TriageService, EmergencyClassificationService, AgencyRoutingService],
})
export class DispatchModule {}
