import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IncidentScopeGuard } from "../../common/auth/incident-scope.guard";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { DispatchService } from "./dispatch.service";
import {
  AssignDispatchIncidentDto,
  DispatchIncidentQuery,
  EscalateDispatchIncidentDto,
  TriageOverrideDto,
  UpdateDispatchAssignmentDto,
  UpdateResponderAvailabilityDto,
} from "./dto/dispatch.dto";

@ApiTags("dispatch")
@ApiBearerAuth()
@Controller("dispatch")
@UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

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

  @Patch("assignments/:id")
  @RequirePermissions("incident:update")
  updateAssignment(@Param("id") id: string, @Body() dto: UpdateDispatchAssignmentDto, @Req() request: any) {
    return this.dispatchService.updateAssignment(id, dto, request.user);
  }

  @Get("responders")
  @RequirePermissions("incident:read")
  listResponders(@Req() request: any, @Query("agencyId") agencyId?: string, @Query("availability") availability?: string, @Query("limit") limit?: string) {
    return this.dispatchService.listResponders(request.user, { agencyId, availability, limit });
  }

  @Patch("responders/:id/status")
  @RequirePermissions("incident:update")
  updateResponderStatus(@Param("id") id: string, @Body() dto: UpdateResponderAvailabilityDto, @Req() request: any) {
    return this.dispatchService.updateResponderStatus(id, dto, request.user);
  }
}
