import { Module, forwardRef } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { IncidentScopeGuard } from "../../common/auth/incident-scope.guard";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { shouldRegisterBullMq } from "../../common/queue/queue-config";
import { INCIDENT_LOCATION_RETRY_QUEUE_NAME } from "../../common/queue/queue-names";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AgencyRoutingService } from "./agency-routing.service";
import { DispatchController } from "./dispatch.controller";
import { DispatchService } from "./dispatch.service";
import { EmergencyClassificationService } from "./emergency-classification.service";
import { EtaService } from "./eta.service";
import { IncidentTimelineService } from "./incident-timeline.service";
import { LocationRetryService } from "./location-retry.service";
import { LocationTrackingService } from "./location-tracking.service";
import { TriageService } from "./triage.service";
import { IncidentsModule } from "../incidents/incidents.module";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    NotificationsModule,
    forwardRef(() => IncidentsModule),
    ...(shouldRegisterBullMq() ? [BullModule.registerQueue({ name: INCIDENT_LOCATION_RETRY_QUEUE_NAME })] : []),
  ],
  controllers: [DispatchController],
  providers: [
    DispatchService,
    TriageService,
    AgencyRoutingService,
    EmergencyClassificationService,
    LocationTrackingService,
    LocationRetryService,
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
    LocationRetryService,
    IncidentTimelineService,
    EtaService,
  ],
})
export class DispatchModule {}
