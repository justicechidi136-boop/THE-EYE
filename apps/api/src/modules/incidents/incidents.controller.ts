import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IncidentStatus } from "@the-eye/shared";
import { IncidentScopeGuard } from "../../common/auth/incident-scope.guard";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/auth/optional-jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { ConfirmIncidentMediaDto, PresignIncidentMediaDto, ReportIncidentDto, UpdateIncidentLocationDto } from "./dto/report-incident.dto";
import type { SosReportDto } from "../dispatch/dto/dispatch.dto";
import { IncidentsService } from "./incidents.service";

class UpdateIncidentStatusDto {
  status!: IncidentStatus;
  note?: string;
}

class AssignIncidentDto {
  agencyId?: string;
  adminId?: string;
  reason?: string;
}

@ApiTags("incidents")
@Controller("incidents")
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post("report")
  @UseGuards(OptionalJwtAuthGuard)
  @RateLimit("incidentCreate")
  report(@Body() dto: ReportIncidentDto, @Req() request: any, @Headers("x-client-submission-id") clientSubmissionId?: string) {
    const payload = clientSubmissionId && !dto.clientSubmissionId ? { ...dto, clientSubmissionId } : dto;
    return this.incidentsService.report(payload, request.user);
  }

  @Post("emergency")
  @UseGuards(OptionalJwtAuthGuard)
  @RateLimit("incidentCreate")
  emergency(@Body() dto: ReportIncidentDto, @Req() request: any, @Headers("x-client-submission-id") clientSubmissionId?: string) {
    const payload = clientSubmissionId && !dto.clientSubmissionId ? { ...dto, clientSubmissionId } : dto;
    return this.incidentsService.reportEmergency(payload, request.user);
  }

  @Post("sos")
  @UseGuards(OptionalJwtAuthGuard)
  @RateLimit("incidentCreate")
  sos(@Body() dto: SosReportDto, @Req() request: any, @Headers("x-client-submission-id") clientSubmissionId?: string) {
    const payload = clientSubmissionId && !dto.clientSubmissionId ? { ...dto, clientSubmissionId } : dto;
    return this.incidentsService.reportSos(payload, request.user);
  }

  @Post(":id/media/presign")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
  @RequirePermissions("incident:create")
  presignMedia(@Param("id") id: string, @Body() dto: PresignIncidentMediaDto, @Req() request: any) {
    return this.incidentsService.presignMedia(id, dto, request.user);
  }

  @Post(":id/media/confirm")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
  @RequirePermissions("incident:create")
  confirmMedia(@Param("id") id: string, @Body() dto: ConfirmIncidentMediaDto, @Req() request: any) {
    return this.incidentsService.confirmMedia(id, dto, request.user);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
  @RequirePermissions("incident:read")
  list(
    @Req() request: any,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
    @Query("status") status?: string,
    @Query("priority") priority?: string,
    @Query("type") type?: string,
  ) {
    return this.incidentsService.list(request.user, { status, priority, type }, { cursor, limit });
  }

  @Get(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
  @RequirePermissions("incident:read")
  get(@Param("id") id: string, @Req() request: any) {
    return this.incidentsService.get(id, request.user);
  }

  @Patch(":id/status")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
  @RequirePermissions("incident:update")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateIncidentStatusDto, @Req() request: any) {
    return this.incidentsService.updateStatus(id, dto.status, dto.note, request.user);
  }

  @Patch(":id/assign")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
  @RequirePermissions("incident:assign")
  assign(@Param("id") id: string, @Body() dto: AssignIncidentDto, @Req() request: any) {
    return this.incidentsService.assign(id, dto, request.user);
  }

  @Post(":id/location")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
  @RequirePermissions("incident:create")
  recordLocation(@Param("id") id: string, @Body() dto: UpdateIncidentLocationDto, @Req() request: any) {
    return this.incidentsService.recordLocation(id, dto, request.user);
  }

  @Get(":id/media/:mediaId/view")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
  @RequirePermissions("incident:read")
  viewMedia(@Param("id") id: string, @Param("mediaId") mediaId: string, @Req() request: any) {
    return this.incidentsService.accessMedia(id, mediaId, "view", request.user);
  }

  @Get(":id/media/:mediaId/download")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard, IncidentScopeGuard)
  @RequirePermissions("incident:read")
  downloadMedia(@Param("id") id: string, @Param("mediaId") mediaId: string, @Req() request: any) {
    return this.incidentsService.accessMedia(id, mediaId, "download", request.user);
  }
}
