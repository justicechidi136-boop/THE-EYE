import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { AgencyRoutingService } from "./agency-routing.service";
import { AgencyRecommendationPreviewDto } from "./dto/agency-recommendation.dto";

@ApiTags("admin-agency-recommendations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("agency:manage")
@Controller("admin/agency-directory/recommendations")
export class AgencyRecommendationController {
  constructor(private readonly routing: AgencyRoutingService) {}

  @Post("preview")
  preview(@Body() dto: AgencyRecommendationPreviewDto, @Req() request: { user: unknown }) {
    return this.routing.preview(dto, request.user as never);
  }
}
