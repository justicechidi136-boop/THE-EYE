import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  AcceptCommunityRecommendationDto,
  ExtendCommunityVerificationDto,
  FlagCommunityVerificationResponseDto,
  IssueCommunityVerificationDto,
  RevokeCommunityVerificationDto,
} from "./dto/community-verification.dto";
import { CommunityVerificationService } from "./community-verification.service";

@ApiTags("admin-community-verifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/community-verifications")
export class CommunityVerificationAdminController {
  constructor(private readonly service: CommunityVerificationService) {}

  @Get("analytics")
  @RequirePermissions("incident:read")
  analytics(
    @Query("country") country?: string,
    @Query("state") state?: string,
    @Query("lga") lga?: string,
  ) {
    return this.service.adminAnalytics({ country, state, lga });
  }

  @Get("incidents/:incidentId")
  @RequirePermissions("incident:read")
  listForIncident(@Param("incidentId") incidentId: string) {
    return this.service.adminListIncidentRequests(incidentId);
  }

  @Post("incidents/:incidentId/issue")
  @RequirePermissions("incident:update")
  issue(
    @Param("incidentId") incidentId: string,
    @Body() dto: IssueCommunityVerificationDto,
    @Req() request: { user: unknown },
  ) {
    return this.service.issueRequests(incidentId, dto, request.user as never);
  }

  @Post("requests/:requestId/revoke")
  @RequirePermissions("incident:update")
  revoke(
    @Param("requestId") requestId: string,
    @Body() dto: RevokeCommunityVerificationDto,
    @Req() request: { user: unknown },
  ) {
    return this.service.adminRevoke(requestId, dto, request.user as never);
  }

  @Post("requests/:requestId/extend")
  @RequirePermissions("incident:update")
  extend(
    @Param("requestId") requestId: string,
    @Body() dto: ExtendCommunityVerificationDto,
    @Req() request: { user: unknown },
  ) {
    return this.service.adminExtendExpiry(requestId, dto, request.user as never);
  }

  @Post("responses/:responseId/flag")
  @RequirePermissions("incident:update")
  flag(
    @Param("responseId") responseId: string,
    @Body() dto: FlagCommunityVerificationResponseDto,
    @Req() request: { user: unknown },
  ) {
    return this.service.adminFlagResponse(responseId, dto, request.user as never);
  }

  @Post("incidents/:incidentId/recommendation")
  @RequirePermissions("incident:update")
  reviewRecommendation(
    @Param("incidentId") incidentId: string,
    @Body() dto: AcceptCommunityRecommendationDto,
    @Req() request: { user: unknown },
  ) {
    return this.service.adminAcceptRecommendation(incidentId, dto, request.user as never);
  }
}
