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
import { EtaService } from "./eta.service";
import { IncidentTimelineService } from "./incident-timeline.service";
import { LocationTrackingService } from "./location-tracking.service";
import { TriageService } from "./triage.service";

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [DispatchController],
  providers: [
    DispatchService,
    TriageService,
    AgencyRoutingService,
    EmergencyClassificationService,
    LocationTrackingService,
    IncidentTimelineService,
    EtaService,
    JwtAuthGuard,
    PermissionsGuard,
    IncidentScopeGuard,
  ],
  exports: [
    DispatchService,
    TriageService,
    EmergencyClassificationService,
    AgencyRoutingService,
    LocationTrackingService,
    IncidentTimelineService,
    EtaService,
  ],
})
export class DispatchModule {}
