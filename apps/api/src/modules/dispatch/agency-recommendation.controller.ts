import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IncidentScopeGuard } from "../../common/auth/incident-scope.guard";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { IncidentsService } from "../incidents/incidents.service";
import { AgencyRoutingService } from "./agency-routing.service";
import { AgencyRecommendationPreviewDto } from "./dto/agency-recommendation.dto";
import { AgencyRecommendationReviewService } from "./agency-recommendation-review.service";
import { AgencyRecommendationQualityReportQueryDto, CreateAgencyRecommendationReviewDto } from "./dto/agency-recommendation-review.dto";

@ApiTags("admin-agency-recommendations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/agency-directory/recommendations")
export class AgencyRecommendationController {
  constructor(
    private readonly routing: AgencyRoutingService,
    private readonly incidents: IncidentsService,
    private readonly reviews: AgencyRecommendationReviewService,
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
    const preview = await this.routing.previewIncident(incident, request.user as never);
    return this.reviews.attachLatestReviews(id, preview, request.user as never);
  }

  @Post("incidents/:id/reviews")
  @RequirePermissions("incident:read")
  review(
    @Param("id") id: string,
    @Body() dto: CreateAgencyRecommendationReviewDto,
    @Req() request: { user: unknown },
  ) {
    return this.reviews.createReview(id, dto, request.user as never);
  }

  @Get("reviews/quality")
  @RequirePermissions("incident:read")
  qualityReport(
    @Query() query: AgencyRecommendationQualityReportQueryDto,
    @Req() request: { user: unknown },
  ) {
    return this.reviews.qualityReport(request.user as never, query);
  }
}
