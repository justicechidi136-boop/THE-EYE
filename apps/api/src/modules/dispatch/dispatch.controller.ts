import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IncidentScopeGuard } from "../../common/auth/incident-scope.guard";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { DispatchService } from "./dispatch.service";
import { IncidentTimelineService } from "./incident-timeline.service";
import { LocationTrackingService } from "./location-tracking.service";
import {
  AssignDispatchIncidentDto,
  AssignmentLocationDto,
  AssignmentNoteDto,
  DispatchIncidentQuery,
  EscalateDispatchIncidentDto,
  ResponderMeAvailabilityDto,
  TriageOverrideDto,
  UpdateDispatchAssignmentDto,
  UpdateResponderAvailabilityDto,
  validateAssignmentLocationDto,
} from "./dto/dispatch.dto";

@ApiTags("dispatch")
@ApiBearerAuth()
@Controller("dispatch")
@UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
export class DispatchController {
  constructor(
    private readonly dispatchService: DispatchService,
    private readonly locationTracking: LocationTrackingService,
    private readonly timelineService: IncidentTimelineService,
  ) {}

  @Get("incidents")
  @RequirePermissions("incident:read")
  listIncidents(@Req() request: any, @Query() query: DispatchIncidentQuery) {
    return this.dispatchService.listIncidents(request.user, query);
  }

  @Get("incidents/:id")
  @RequirePermissions("incident:read")
  getIncident(@Param("id") id: string, @Req() request: any) {
    return this.dispatchService.getIncident(id, request.user);
  }

  @Get("incidents/:id/timeline")
  @RequirePermissions("incident:read")
  getIncidentTimeline(@Param("id") id: string, @Req() request: any, @Query("audience") audience?: string) {
    const resolvedAudience = audience === "citizen" || audience === "responder" ? audience : "dispatcher";
    return this.timelineService.buildTimeline(id, resolvedAudience, request.user);
  }

  @Post("incidents/:id/assign")
  @RequirePermissions("incident:assign")
  @RateLimit("incidentCreate")
  assignIncident(@Param("id") id: string, @Body() dto: AssignDispatchIncidentDto, @Req() request: any) {
    return this.dispatchService.assignIncident(id, dto, request.user);
  }

  @Post("incidents/:id/escalate")
  @RequirePermissions("incident:escalate")
  escalateIncident(@Param("id") id: string, @Body() dto: EscalateDispatchIncidentDto, @Req() request: any) {
    return this.dispatchService.escalateIncident(id, dto, request.user);
  }

  @Post("incidents/:id/triage")
  @RequirePermissions("incident:update")
  overrideTriage(@Param("id") id: string, @Body() dto: TriageOverrideDto, @Req() request: any) {
    return this.dispatchService.runTriageForIncident(id, request.user, dto);
  }

  @Post("incidents/:id/request-info")
  @RequirePermissions("incident:update")
  requestMoreInformation(@Param("id") id: string, @Body() body: { reason: string }, @Req() request: any) {
    return this.dispatchService.requestMoreInformation(id, body, request.user);
  }

  @Get("assignments/:id")
  @RequirePermissions("incident:read")
  getAssignment(@Param("id") id: string, @Req() request: any) {
    return this.dispatchService.getAssignment(id, request.user);
  }

  @Patch("assignments/:id")
  @RequirePermissions("incident:update")
  updateAssignment(@Param("id") id: string, @Body() dto: UpdateDispatchAssignmentDto, @Req() request: any) {
    return this.dispatchService.updateAssignment(id, dto, request.user);
  }

  @Post("assignments/:id/location")
  @RequirePermissions("incident:update")
  recordAssignmentLocation(@Param("id") id: string, @Body() dto: AssignmentLocationDto, @Req() request: any) {
    validateAssignmentLocationDto(dto);
    return this.locationTracking.recordResponderLocation(id, dto, request.user);
  }

  @Get("assignments/:id/live-location")
  @RequirePermissions("incident:read")
  getAssignmentLiveLocation(@Param("id") id: string, @Req() request: any) {
    return this.locationTracking.getResponderLiveLocation(id, request.user);
  }

  @Post("assignments/:id/request-backup")
  @RequirePermissions("incident:update")
  requestBackup(@Param("id") id: string, @Body() body: { reason: string }, @Req() request: any) {
    return this.dispatchService.requestAssignmentBackup(id, body.reason, request.user);
  }

  @Post("assignments/:id/note")
  @RequirePermissions("incident:update")
  addNote(@Param("id") id: string, @Body() dto: AssignmentNoteDto, @Req() request: any) {
    return this.dispatchService.addAssignmentNote(id, dto, request.user);
  }

  @Get("responders")
  @RequirePermissions("incident:read")
  listResponders(@Req() request: any, @Query("agencyId") agencyId?: string, @Query("availability") availability?: string, @Query("limit") limit?: string) {
    return this.dispatchService.listResponders(request.user, { agencyId, availability, limit });
  }

  @Get("responders/me")
  @RequirePermissions("incident:read")
  getResponderMe(@Req() request: any) {
    return this.dispatchService.getResponderMe(request.user);
  }

  @Get("responders/me/assignments")
  @RequirePermissions("incident:read")
  getMyAssignments(@Req() request: any, @Query("status") status?: string, @Query("limit") limit?: string) {
    return this.dispatchService.getMyAssignments(request.user, { status, limit });
  }

  @Patch("responders/me/status")
  @RequirePermissions("incident:update")
  updateMyAvailability(@Req() request: any, @Body() dto: ResponderMeAvailabilityDto) {
    return this.dispatchService.updateMyAvailability(request.user, dto);
  }

  @Patch("responders/:id/status")
  @RequirePermissions("incident:update")
  updateResponderStatus(@Param("id") id: string, @Body() dto: UpdateResponderAvailabilityDto, @Req() request: any) {
    return this.dispatchService.updateResponderStatus(id, dto, request.user);
  }
}
