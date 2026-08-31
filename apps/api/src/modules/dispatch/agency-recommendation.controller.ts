import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IncidentScopeGuard } from "../../common/auth/incident-scope.guard";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { IncidentsService } from "../incidents/incidents.service";
import { AgencyRoutingService } from "./agency-routing.service";
import { AgencyRecommendationPreviewDto } from "./dto/agency-recommendation.dto";

@ApiTags("admin-agency-recommendations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/agency-directory/recommendations")
export class AgencyRecommendationController {
  constructor(
    private readonly routing: AgencyRoutingService,
    private readonly incidents: IncidentsService,
  ) {}

  @Post("preview")
  @RequirePermissions("agency:manage")
  preview(@Body() dto: AgencyRecommendationPreviewDto, @Req() request: { user: unknown }) {
    return this.routing.preview(dto, request.user as never);
  }

  @Get("incidents/:id")
  @UseGuards(IncidentScopeGuard)
  @RequirePermissions("incident:read")
  async incidentPreview(@Param("id") id: string, @Req() request: { user: unknown }) {
    const incident = await this.incidents.get(id, request.user as never);
    return this.routing.previewIncident(incident, request.user as never);
  }
}
