import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { DispatchModule } from "../dispatch/dispatch.module";
import { DroneSurveillanceModule } from "../drone-surveillance/drone-surveillance.module";
import { PrismaModule } from "../prisma/prisma.module";
import { FieldAssignmentsService } from "./field-assignments.service";
import { FieldAuthService } from "./field-auth.service";
import { FieldBoloService } from "./field-bolo.service";
import { FieldCheckpointsService } from "./field-checkpoints.service";
import { FieldDashboardService } from "./field-dashboard.service";
import { FieldDevicesAdminService } from "./field-devices-admin.service";
import { FieldDevicesService } from "./field-devices.service";
import { FieldDroneReadService } from "./field-drone-read.service";
import { FieldOperationalResponsesService } from "./field-operational-responses.service";
import { FieldPatrolsService } from "./field-patrols.service";
import { FieldShiftsService } from "./field-shifts.service";
import { FieldSyncService } from "./field-sync.service";
import { FieldWorkflowsAdminService } from "./field-workflows-admin.service";
import { FieldAuthController, FieldDevicesAdminController, FieldDevicesController } from "./field-operations.controller";
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
  imports: [PrismaModule, AuditModule, DispatchModule, DroneSurveillanceModule],
  controllers: [
    FieldDevicesController,
    FieldAuthController,
    FieldDevicesAdminController,
    FieldDashboardController,
    FieldShiftsController,
    FieldPatrolsController,
    FieldCheckpointsController,
    FieldAssignmentsController,
    FieldResponsesController,
    FieldBoloController,
    FieldDroneController,
    FieldSyncController,
    FieldWorkflowsAdminController,
  ],
  providers: [
    FieldDevicesService,
    FieldAuthService,
    FieldDevicesAdminService,
    FieldShiftsService,
    FieldPatrolsService,
    FieldCheckpointsService,
    FieldDashboardService,
    FieldBoloService,
    FieldOperationalResponsesService,
    FieldSyncService,
    FieldAssignmentsService,
    FieldDroneReadService,
    FieldWorkflowsAdminService,
  ],
  exports: [FieldDevicesService, FieldAuthService],
})
export class FieldOperationsModule {}
