import { Module } from "@nestjs/common";
import { AgenciesModule } from "../agencies/agencies.module";
import { AuditModule } from "../audit/audit.module";
import { DispatchModule } from "../dispatch/dispatch.module";
import { DroneSurveillanceModule } from "../drone-surveillance/drone-surveillance.module";
import { IncidentCommunicationsModule } from "../incident-communications/incident-communications.module";
import { DangerTriggerModule } from "../danger-trigger/danger-trigger.module";
import { PrismaModule } from "../prisma/prisma.module";
import { FieldAssignmentsService } from "./field-assignments.service";
import { FieldAuthService } from "./field-auth.service";
import { FieldBackupRequestsService } from "./field-backup-requests.service";
import { FieldBoloService } from "./field-bolo.service";
import { FieldCheckpointHardeningService } from "./field-checkpoint-hardening.service";
import { FieldCheckpointsService } from "./field-checkpoints.service";
import { FieldCommsController } from "./field-comms.controller";
import { FieldDashboardService } from "./field-dashboard.service";
import { FieldDevicesAdminService } from "./field-devices-admin.service";
import { FieldDevicesService } from "./field-devices.service";
import { FieldLauncherPolicyService } from "./field-launcher-policy.service";
import { FieldDroneReadService } from "./field-drone-read.service";
import { FieldEventsService } from "./field-events.service";
import { FieldMapService } from "./field-map.service";
import { FieldOfficerSafetyService } from "./field-officer-safety.service";
import { FieldOperationalResponsesService } from "./field-operational-responses.service";
import { FieldPatrolHardeningService } from "./field-patrol-hardening.service";
import { FieldPatrolsService } from "./field-patrols.service";
import { FieldPermissionPolicyService } from "./field-permission-policy.service";
import { FieldPermissionProfilesService } from "./field-permission-profiles.service";
import { FieldDevicePreprovisionService } from "./field-device-preprovision.service";
import { FieldDevicePairingService } from "./field-device-pairing.service";
import { FieldShiftsService } from "./field-shifts.service";
import { FieldSyncService } from "./field-sync.service";
import { FieldWorkflowsAdminService } from "./field-workflows-admin.service";
import { FieldAuthController, FieldDevicesAdminController, FieldDevicesController } from "./field-operations.controller";
import { FieldPermissionProfilesAdminController, FieldPermissionsAdminController } from "./field-permission-profiles.controller";
import { FieldDeviceProvisioningAdminController } from "./field-device-preprovisioning.controller";
import { FieldPairingController } from "./field-pairing.controller";
import {
  FieldBackupController,
  FieldEventsController,
  FieldMapController,
  FieldSafetyController,
} from "./field-sprint3.controller";
import {
  FieldAssignmentsController,
  FieldBoloController,
  FieldCheckpointsController,
  FieldDashboardController,
  FieldDroneController,
  FieldPatrolsController,
  FieldResponsesController,
  FieldShiftsController,
  FieldSyncController,
  FieldWorkflowsAdminController,
} from "./field-workflows.controller";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    DispatchModule,
    DroneSurveillanceModule,
    IncidentCommunicationsModule,
    AgenciesModule,
    DangerTriggerModule,
  ],
  controllers: [
    FieldDevicesController,
    FieldAuthController,
    FieldDevicesAdminController,
    FieldDeviceProvisioningAdminController,
    FieldPermissionProfilesAdminController,
    FieldPermissionsAdminController,
    FieldPairingController,
    FieldDashboardController,
    FieldShiftsController,
    FieldPatrolsController,
    FieldCheckpointsController,
    FieldAssignmentsController,
    FieldResponsesController,
    FieldBoloController,
    FieldDroneController,
    FieldSyncController,
    FieldMapController,
    FieldEventsController,
    FieldSafetyController,
    FieldBackupController,
    FieldCommsController,
    FieldWorkflowsAdminController,
  ],
  providers: [
    FieldDevicesService,
    FieldAuthService,
    FieldDevicesAdminService,
    FieldLauncherPolicyService,
    FieldPermissionPolicyService,
    FieldPermissionProfilesService,
    FieldDevicePreprovisionService,
    FieldDevicePairingService,
    FieldShiftsService,
    FieldPatrolsService,
    FieldPatrolHardeningService,
    FieldCheckpointsService,
    FieldCheckpointHardeningService,
    FieldDashboardService,
    FieldBoloService,
    FieldOperationalResponsesService,
    FieldSyncService,
    FieldAssignmentsService,
    FieldDroneReadService,
    FieldWorkflowsAdminService,
    FieldMapService,
    FieldEventsService,
    FieldOfficerSafetyService,
    FieldBackupRequestsService,
  ],
  exports: [FieldDevicesService, FieldAuthService, FieldPermissionPolicyService],
})
export class FieldOperationsModule {}

