import { Module, forwardRef } from "@nestjs/common";
import { IncidentScopeGuard } from "../../common/auth/incident-scope.guard";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/auth/optional-jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { VerificationModule } from "../verification/verification.module";
import { CommunityVerificationModule } from "../community-verification/community-verification.module";
import { DispatchModule } from "../dispatch/dispatch.module";
import { VoiceAttachmentsModule } from "../voice-attachments/voice-attachments.module";
import { ActiveEmergencyService } from "./active-emergency.service";
import { IncidentsController } from "./incidents.controller";
import { IncidentsService } from "./incidents.service";
import { CaseManagementController } from "./case-management.controller";
import { CaseManagementService } from "./case-management.service";
import { JurisdictionResolutionService } from "./jurisdiction-resolution.service";
import { JurisdictionCorrectionService } from "./jurisdiction-correction.service";

@Module({
  imports: [AuditModule, NotificationsModule, PrismaModule, VerificationModule, CommunityVerificationModule, VoiceAttachmentsModule, forwardRef(() => DispatchModule)],
  controllers: [IncidentsController, CaseManagementController],
  providers: [
    IncidentsService,
    ActiveEmergencyService,
    CaseManagementService,
    JurisdictionResolutionService,
    JurisdictionCorrectionService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    PermissionsGuard,
    IncidentScopeGuard,
  ],
  exports: [IncidentsService, ActiveEmergencyService, JurisdictionResolutionService, JurisdictionCorrectionService],
})
export class IncidentsModule {}
