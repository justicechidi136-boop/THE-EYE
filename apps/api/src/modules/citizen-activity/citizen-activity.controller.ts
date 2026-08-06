import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { CitizenActivityService } from "./citizen-activity.service";
import type { ActivityHistoryQuery } from "./dto/activity-history.dto";

@ApiTags("citizen-activity")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class CitizenActivityController {
  constructor(private readonly citizenActivity: CitizenActivityService) {}

  @Get("users/me/activity-history")
  @RequirePermissions("incident:read")
  @RateLimit("auth")
  listMine(@Req() request: { user: Parameters<CitizenActivityService["listActivityHistory"]>[0] }, @Query() query: ActivityHistoryQuery) {
    return this.citizenActivity.listActivityHistory(request.user, query);
  }

  @Get("incidents/:id/archive")
  @RequirePermissions("incident:read")
  incidentArchive(
    @Param("id") id: string,
    @Req() request: { user: Parameters<CitizenActivityService["getIncidentArchive"]>[1] },
  ) {
    return this.citizenActivity.getIncidentArchive(id, request.user);
  }

  @Get("broadcasts/:id/archive")
  @RequirePermissions("incident:read")
  broadcastArchive(
    @Param("id") id: string,
    @Req() request: { user: Parameters<CitizenActivityService["getIncidentArchive"]>[1] },
  ) {
    return this.citizenActivity.getBroadcastArchive(id, request.user);
  }
}
