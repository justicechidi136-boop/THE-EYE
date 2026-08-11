import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { BroadcastCitizenService } from "./broadcast-citizen.service";
import { BroadcastsService } from "./broadcasts.service";
import { CreateBroadcastDto, NearbyBroadcastsQuery, RejectBroadcastDto, ReviewBroadcastDto, ScheduleBroadcastDto } from "./dto/broadcast.dto";
import {
  CreateCitizenBroadcastCommentDto,
  CreateMissingPersonBroadcastDto,
  CreateStolenVehicleBroadcastDto,
  ReportBroadcastDto,
  ResolveBroadcastDto,
  SubmitBroadcastSightingDto,
  WithdrawBroadcastDto,
} from "./dto/citizen-broadcast.dto";

@ApiTags("broadcasts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("broadcasts")
export class BroadcastsController {
  constructor(
    private readonly broadcastsService: BroadcastsService,
    private readonly broadcastCitizen: BroadcastCitizenService,
  ) {}

  @Get("mine")
  @RequirePermissions("incident:read")
  listMine(@Req() request: any, @Query("status") status?: string) {
    return this.broadcastCitizen.listMine(request.user, status);
  }

  @Post("media/presign")
  @RateLimit("broadcastCreate")
  @RequirePermissions("incident:create")
  presignMedia(
    @Body()
    dto: { fileName?: string; contentType?: string; mediaType?: string; sizeBytes?: number },
    @Req() request: any,
  ) {
    return this.broadcastCitizen.presignMedia(request.user, dto);
  }

  @Post("missing-person")
  @RateLimit("broadcastCreate")
  @RequirePermissions("incident:create")
  createMissingPerson(@Body() dto: CreateMissingPersonBroadcastDto, @Req() request: any) {
    return this.broadcastCitizen.createMissingPerson(dto, request.user);
  }

  @Post("stolen-vehicle")
  @RateLimit("broadcastCreate")
  @RequirePermissions("incident:create")
  createStolenVehicle(@Body() dto: CreateStolenVehicleBroadcastDto, @Req() request: any) {
    return this.broadcastCitizen.createStolenVehicle(dto, request.user);
  }

  @Get()
  @RequirePermissions("broadcast:create")
  list(@Req() request: any, @Query("cursor") cursor?: string, @Query("limit") limit?: string) {
    return this.broadcastsService.list(request.user, { cursor, limit });
  }

  @Post()
  @RateLimit("broadcastCreate")
  @RequirePermissions("broadcast:create")
  create(@Body() dto: CreateBroadcastDto, @Req() request: any) {
    return this.broadcastsService.create(dto, request.user);
  }

  @Get("nearby")
  @RequirePermissions("incident:read")
  nearby(@Query() query: NearbyBroadcastsQuery, @Req() request: any) {
    return this.broadcastsService.nearbyForUser(request.user.sub, Number(query.latitude), Number(query.longitude), {
      radiusMeters: query.radiusMeters ? Number(query.radiusMeters) : undefined,
      cursor: query.cursor,
      limit: query.limit ? Number(query.limit) : undefined,
      category: query.category,
      severity: query.severity,
      unreadOnly: query.unreadOnly === "true",
    });
  }

  @Get("unread-count")
  @RequirePermissions("incident:read")
  unreadCount(@Req() request: any) {
    return this.broadcastsService.unreadCount(request.user.sub);
  }

  @Get("admin/scheduler-health")
  @RequirePermissions("broadcast:publish")
  schedulerHealth(@Req() request: any) {
    return this.broadcastsService.getSchedulerHealth(request.user);
  }

  @Post("auto/verified-incident/:incidentId")
  @RequirePermissions("broadcast:publish")
  autoBroadcast(@Param("incidentId") incidentId: string, @Body() body: { confidenceScore: number }) {
    return this.broadcastsService.autoBroadcastVerifiedIncident(incidentId, body.confidenceScore);
  }

  @Post(":id/sightings")
  @RateLimit("broadcastCreate")
  @RequirePermissions("incident:read")
  submitSighting(@Param("id") id: string, @Body() dto: SubmitBroadcastSightingDto, @Req() request: any) {
    return this.broadcastCitizen.submitSighting(id, dto, request.user);
  }

  @Get(":id/share")
  @RequirePermissions("incident:read")
  share(@Param("id") id: string) {
    return this.broadcastCitizen.getShare(id);
  }

  @Post(":id/resolve")
  @RequirePermissions("incident:create")
  resolve(@Param("id") id: string, @Body() dto: ResolveBroadcastDto, @Req() request: any) {
    return this.broadcastCitizen.resolve(id, dto, request.user);
  }

  @Post(":id/withdraw")
  @RequirePermissions("incident:create")
  withdraw(@Param("id") id: string, @Body() dto: WithdrawBroadcastDto, @Req() request: any) {
    return this.broadcastCitizen.withdraw(id, dto, request.user);
  }

  @Post(":id/report")
  @RequirePermissions("incident:read")
  report(@Param("id") id: string, @Body() dto: ReportBroadcastDto, @Req() request: any) {
    return this.broadcastCitizen.report(id, dto, request.user);
  }

  @Post(":id/comments")
  @RequirePermissions("incident:read")
  addComment(@Param("id") id: string, @Body() dto: CreateCitizenBroadcastCommentDto, @Req() request: any) {
    return this.broadcastCitizen.addComment(id, dto, request.user);
  }

  @Get(":id/comments")
  @RequirePermissions("incident:read")
  listComments(@Param("id") id: string) {
    return this.broadcastCitizen.listComments(id);
  }

  @Get(":id")
  async getOne(@Param("id") id: string, @Req() request: any) {
    const permissions = new Set(request.user?.permissions ?? []);
    if (permissions.has("broadcast:create")) {
      return this.broadcastsService.get(id, request.user);
    }
    if (permissions.has("incident:read")) {
      return this.broadcastsService.getForCitizen(id, request.user);
    }
    throw new ForbiddenException("Missing required permission");
  }

  @Patch(":id/read")
  @RequirePermissions("incident:read")
  markRead(@Param("id") id: string, @Req() request: any) {
    return this.broadcastsService.markRead(id, request.user);
  }

  @Get(":id/preview")
  @RequirePermissions("broadcast:create")
  preview(@Param("id") id: string, @Req() request: any) {
    return this.broadcastsService.preview(id, request.user);
  }

  @Get(":id/estimate-recipients")
  @RequirePermissions("broadcast:create")
  estimateRecipients(@Param("id") id: string, @Req() request: any) {
    return this.broadcastsService.estimateRecipients(id, request.user);
  }

  @Get(":id/progress")
  @RequirePermissions("broadcast:create")
  progress(@Param("id") id: string, @Req() request: any) {
    return this.broadcastsService.deliveryProgress(id, request.user);
  }

  @Patch(":id/schedule")
  @RequirePermissions("broadcast:publish")
  schedule(@Param("id") id: string, @Body() dto: ScheduleBroadcastDto, @Req() request: any) {
    return this.broadcastsService.schedule(id, request.user, dto.scheduledAt);
  }

  @Patch(":id/cancel")
  @RequirePermissions("broadcast:publish")
  cancel(@Param("id") id: string, @Body() body: { reason?: string }, @Req() request: any) {
    return this.broadcastsService.cancel(id, request.user, body.reason);
  }

  @Post(":id/retry")
  @RequirePermissions("broadcast:publish")
  retry(@Param("id") id: string, @Req() request: any) {
    return this.broadcastsService.retryFailed(id, request.user);
  }

  @Patch(":id/approve")
  @RequirePermissions("broadcast:approve")
  approve(@Param("id") id: string, @Body() dto: ReviewBroadcastDto, @Req() request: any) {
    return this.broadcastsService.approve(id, request.user, dto.note);
  }

  @Patch(":id/reject")
  @RequirePermissions("broadcast:approve")
  reject(@Param("id") id: string, @Body() dto: RejectBroadcastDto, @Req() request: any) {
    return this.broadcastsService.reject(id, request.user, dto.reason);
  }

  @Post(":id/dispatch")
  @RequirePermissions("broadcast:publish")
  dispatch(@Param("id") id: string, @Req() request: any) {
    return this.broadcastsService.dispatch(id, request.user);
  }
}
