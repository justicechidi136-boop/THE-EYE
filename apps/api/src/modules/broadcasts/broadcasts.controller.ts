import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { BroadcastsService } from "./broadcasts.service";
import { CreateBroadcastDto, NearbyBroadcastsQuery, RejectBroadcastDto, ReviewBroadcastDto } from "./dto/broadcast.dto";

@ApiTags("broadcasts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("broadcasts")
export class BroadcastsController {
  constructor(private readonly broadcastsService: BroadcastsService) {}

  @Get()
  @RequirePermissions("broadcast:create")
  list(@Req() request: any) {
    return this.broadcastsService.list(request.user);
  }

  @Post()
  @RequirePermissions("broadcast:create")
  create(@Body() dto: CreateBroadcastDto, @Req() request: any) {
    return this.broadcastsService.create(dto, request.user);
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

  @Post("auto/verified-incident/:incidentId")
  @RequirePermissions("broadcast:publish")
  autoBroadcast(@Param("incidentId") incidentId: string, @Body() body: { confidenceScore: number }) {
    return this.broadcastsService.autoBroadcastVerifiedIncident(incidentId, body.confidenceScore);
  }

  @Get("nearby")
  @RequirePermissions("incident:read")
  nearby(@Query() query: NearbyBroadcastsQuery, @Req() request: any) {
    return this.broadcastsService.nearbyForUser(
      request.user.sub,
      Number(query.latitude),
      Number(query.longitude),
      query.radiusMeters ? Number(query.radiusMeters) : undefined,
    );
  }
}
