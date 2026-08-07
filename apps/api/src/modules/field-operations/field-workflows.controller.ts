import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import type {
  CheckpointQueueDto,
  EndFieldShiftDto,
  FieldBoloSearchDto,
  FieldSyncBatchDto,
  FieldTelemetryDto,
  OperationalResponseDto,
  OperationalSightingDto,
  PatrolLocationDto,
  StartCheckpointSessionDto,
  StartFieldShiftDto,
  StartPatrolSessionDto,
} from "./dto/field-workflows.dto";
import { FieldAssignmentsService } from "./field-assignments.service";
import { FieldBoloService } from "./field-bolo.service";
import { FieldCheckpointsService } from "./field-checkpoints.service";
import { FieldDashboardService } from "./field-dashboard.service";
import { FieldDroneReadService } from "./field-drone-read.service";
import { FieldOperationalResponsesService } from "./field-operational-responses.service";
import { FieldPatrolsService } from "./field-patrols.service";
import { FieldPatrolHardeningService } from "./field-patrol-hardening.service";
import { FieldCheckpointHardeningService } from "./field-checkpoint-hardening.service";
import { FieldShiftsService } from "./field-shifts.service";
import { FieldSyncService } from "./field-sync.service";
import { FieldWorkflowsAdminService } from "./field-workflows-admin.service";
import type { AssignmentLocationDto, UpdateDispatchAssignmentDto } from "../dispatch/dto/dispatch.dto";

@ApiTags("field-dashboard")
@Controller("field/dashboard")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldDashboardController {
  constructor(private readonly dashboard: FieldDashboardService) {}

  @Get()
  @RequirePermissions("field:session:operate")
  getDashboard(@Req() request: { user: never }) {
    return this.dashboard.getDashboard(request.user);
  }

  @Post("telemetry")
  @RequirePermissions("field:session:operate")
  telemetry(@Req() request: { user: never }, @Body() dto: FieldTelemetryDto) {
    return this.dashboard.updateTelemetry(request.user, dto);
  }
}

@ApiTags("field-shifts")
@Controller("field/shifts")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldShiftsController {
  constructor(private readonly shifts: FieldShiftsService) {}

  @Get("active")
  @RequirePermissions("field:session:operate")
  active(@Req() request: { user: never }) {
    return this.shifts.getActiveShift(request.user);
  }

  @Post("start")
  @RequirePermissions("field:session:operate")
  @RateLimit("incidentCreate")
  start(@Req() request: { user: never }, @Body() dto: StartFieldShiftDto) {
    return this.shifts.startShift(request.user, dto);
  }

  @Post("pause")
  @RequirePermissions("field:session:operate")
  pause(@Req() request: { user: never }) {
    return this.shifts.pauseShift(request.user);
  }

  @Post("resume")
  @RequirePermissions("field:session:operate")
  resume(@Req() request: { user: never }) {
    return this.shifts.resumeShift(request.user);
  }

  @Post("end")
  @RequirePermissions("field:session:operate")
  end(@Req() request: { user: never }, @Body() dto: EndFieldShiftDto) {
    return this.shifts.endShift(request.user, dto);
  }
}

@ApiTags("field-patrols")
@Controller("field/patrols")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldPatrolsController {
  constructor(
    private readonly patrols: FieldPatrolsService,
    private readonly patrolHardening: FieldPatrolHardeningService,
  ) {}

  @Get("active")
  @RequirePermissions("field:session:operate")
  active(@Req() request: { user: never }) {
    return this.patrols.getActivePatrol(request.user);
  }

  @Post("start")
  @RequirePermissions("field:session:operate")
  start(@Req() request: { user: never }, @Body() dto: StartPatrolSessionDto) {
    return this.patrols.startPatrol(request.user, dto);
  }

  @Post("pause")
  @RequirePermissions("field:session:operate")
  pause(@Req() request: { user: never }) {
    return this.patrols.pausePatrol(request.user);
  }

  @Post("resume")
  @RequirePermissions("field:session:operate")
  resume(@Req() request: { user: never }) {
    return this.patrols.resumePatrol(request.user);
  }

  @Post("end")
  @RequirePermissions("field:session:operate")
  end(@Req() request: { user: never }) {
    return this.patrols.endPatrol(request.user);
  }

  @Post("location")
  @RequirePermissions("field:session:operate")
  location(@Req() request: { user: never }, @Body() dto: PatrolLocationDto) {
    return this.patrols.recordLocation(request.user, dto);
  }

  @Post("events")
  @RequirePermissions("field:session:operate")
  recordEvent(@Req() request: { user: never }, @Body() dto: Record<string, unknown>) {
    return this.patrolHardening.recordEvent(request.user, dto as never);
  }

  @Get(":id/route-history")
  @RequirePermissions("field:session:operate")
  routeHistory(@Param("id") id: string, @Req() request: { user: never }) {
    return this.patrolHardening.getRouteHistory(request.user, id);
  }
}

@ApiTags("field-checkpoints")
@Controller("field/checkpoints")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldCheckpointsController {
  constructor(
    private readonly checkpoints: FieldCheckpointsService,
    private readonly checkpointHardening: FieldCheckpointHardeningService,
  ) {}

  @Get("active")
  @RequirePermissions("field:session:operate")
  active(@Req() request: { user: never }) {
    return this.checkpoints.getActiveCheckpoint(request.user);
  }

  @Post("start")
  @RequirePermissions("field:session:operate")
  start(@Req() request: { user: never }, @Body() dto: StartCheckpointSessionDto) {
    return this.checkpoints.startCheckpoint(request.user, dto);
  }

  @Post("pause")
  @RequirePermissions("field:session:operate")
  pause(@Req() request: { user: never }) {
    return this.checkpoints.pauseCheckpoint(request.user);
  }

  @Post("resume")
  @RequirePermissions("field:session:operate")
  resume(@Req() request: { user: never }) {
    return this.checkpoints.resumeCheckpoint(request.user);
  }

  @Post("end")
  @RequirePermissions("field:session:operate")
  end(@Req() request: { user: never }) {
    return this.checkpoints.endCheckpoint(request.user);
  }

  @Patch("queue")
  @RequirePermissions("field:session:operate")
  queue(@Req() request: { user: never }, @Body() dto: CheckpointQueueDto) {
    return this.checkpoints.updateQueue(request.user, dto);
  }

  @Get("search")
  @RequirePermissions("field:session:operate")
  search(@Req() request: { user: never }, @Query("q") q?: string, @Query("type") type?: string, @Query("limit") limit?: string) {
    return this.checkpoints.search(request.user, { q, type, limit });
  }

  @Post("observations")
  @RequirePermissions("field:session:operate")
  observation(@Req() request: { user: never }, @Body() dto: Record<string, unknown>) {
    return this.checkpointHardening.recordObservation(request.user, dto as never);
  }

  @Get("closure-summary")
  @RequirePermissions("field:session:operate")
  closureSummary(@Req() request: { user: never }) {
    return this.checkpointHardening.closureSummary(request.user);
  }
}

@ApiTags("field-assignments")
@Controller("field/assignments")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldAssignmentsController {
  constructor(private readonly assignments: FieldAssignmentsService) {}

  @Get("mine")
  @RequirePermissions("field:session:operate")
  mine(@Req() request: { user: never }, @Query("status") status?: string, @Query("limit") limit?: string) {
    return this.assignments.listMine(request.user, { status, limit });
  }

  @Get(":id")
  @RequirePermissions("field:session:operate")
  get(@Param("id") id: string, @Req() request: { user: never }) {
    return this.assignments.getAssignment(request.user, id);
  }

  @Patch(":id")
  @RequirePermissions("field:session:operate")
  update(@Param("id") id: string, @Body() dto: UpdateDispatchAssignmentDto, @Req() request: { user: never }) {
    return this.assignments.updateAssignment(request.user, id, dto);
  }

  @Post(":id/location")
  @RequirePermissions("field:session:operate")
  location(@Param("id") id: string, @Body() dto: AssignmentLocationDto, @Req() request: { user: never }) {
    return this.assignments.recordLocation(request.user, id, dto);
  }

  @Get(":id/live-location")
  @RequirePermissions("field:session:operate")
  liveLocation(@Param("id") id: string, @Req() request: { user: never }) {
    return this.assignments.liveLocation(request.user, id);
  }

  @Post(":id/backup")
  @RequirePermissions("field:session:operate")
  backup(@Param("id") id: string, @Body() body: { reason: string }, @Req() request: { user: never }) {
    return this.assignments.requestBackup(request.user, id, body.reason);
  }

  @Get(":id/timeline")
  @RequirePermissions("field:session:operate")
  timeline(@Param("id") id: string, @Req() request: { user: never }) {
    return this.assignments.getIncidentTimeline(request.user, id);
  }
}

@ApiTags("field-responses")
@Controller("field/responses")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldResponsesController {
  constructor(private readonly responses: FieldOperationalResponsesService) {}

  @Post()
  @RequirePermissions("field:session:operate")
  record(@Req() request: { user: never }, @Body() dto: OperationalResponseDto) {
    return this.responses.recordResponse(request.user, dto);
  }

  @Get("assignments/:assignmentId")
  @RequirePermissions("field:session:operate")
  forAssignment(@Param("assignmentId") assignmentId: string, @Req() request: { user: never }) {
    return this.responses.listForAssignment(request.user, assignmentId);
  }
}

@ApiTags("field-bolo")
@Controller("field/bolo")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldBoloController {
  constructor(private readonly bolo: FieldBoloService) {}

  @Get()
  @RequirePermissions("field:session:operate")
  search(@Req() request: { user: never }, @Query() query: FieldBoloSearchDto) {
    return this.bolo.search(request.user, query);
  }

  @Post("sightings")
  @RequirePermissions("field:session:operate")
  createSighting(@Req() request: { user: never }, @Body() dto: OperationalSightingDto) {
    return this.bolo.createSighting(request.user, dto);
  }
}

@ApiTags("field-drone")
@Controller("field/drone")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldDroneController {
  constructor(private readonly drone: FieldDroneReadService) {}

  @Get("missions")
  @RequirePermissions("field:session:operate")
  missions(@Req() request: { user: never }) {
    return this.drone.listOperationalMissions(request.user);
  }

  @Get("missions/:id")
  @RequirePermissions("field:session:operate")
  mission(@Param("id") id: string, @Req() request: { user: never }) {
    return this.drone.getMission(request.user, id);
  }

  @Post("request")
  @RequirePermissions("field:session:operate")
  request(@Req() request: { user: never }, @Body() body: { incidentId?: string; reason?: string }) {
    return this.drone.requestDrone(request.user, body);
  }
}

@ApiTags("field-sync")
@Controller("field/sync")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldSyncController {
  constructor(private readonly sync: FieldSyncService) {}

  @Post("batch")
  @RequirePermissions("field:session:operate")
  batch(@Req() request: { user: never }, @Body() dto: FieldSyncBatchDto) {
    return this.sync.syncBatch(request.user, dto);
  }
}

@ApiTags("admin-field-operations")
@Controller("admin/field-operations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldWorkflowsAdminController {
  constructor(
    private readonly admin: FieldWorkflowsAdminService,
    private readonly fieldShifts: FieldShiftsService,
  ) {}

  @Get("monitoring")
  @RequirePermissions("field:device:manage")
  monitoring(
    @Req() request: { user: never },
    @Query("agencyId") agencyId?: string,
    @Query("state") state?: string,
    @Query("status") status?: string,
  ) {
    return this.admin.monitoringSummary(request.user, { agencyId, state, status });
  }

  @Get("patrols")
  @RequirePermissions("field:device:manage")
  patrols(@Req() request: { user: never }, @Query("agencyId") agencyId?: string, @Query("limit") limit?: string) {
    return this.admin.listPatrols(request.user, { agencyId, limit });
  }

  @Get("checkpoints")
  @RequirePermissions("field:device:manage")
  checkpoints(@Req() request: { user: never }, @Query("agencyId") agencyId?: string, @Query("limit") limit?: string) {
    return this.admin.listCheckpoints(request.user, { agencyId, limit });
  }

  @Get("shifts")
  @RequirePermissions("field:device:manage")
  listShifts(@Req() request: { user: never }, @Query("agencyId") agencyId?: string, @Query("limit") limit?: string) {
    return this.admin.listShifts(request.user, { agencyId, limit });
  }

  @Post("shifts/:id/approve")
  @RequirePermissions("field:device:approve")
  approveShift(@Param("id") id: string, @Req() request: { user: never }, @Body() body: { note?: string }) {
    return this.fieldShifts.approveShift(id, request.user, body.note);
  }
}
