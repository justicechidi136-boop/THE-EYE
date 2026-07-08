import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { LinkLiveVideoEvidenceDto, LiveVideoLocationUpdateDto, StartLiveVideoDto } from "./dto/live-video.dto";
import { LiveVideoService } from "./live-video.service";

@ApiTags("live-video")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("live-video")
export class LiveVideoController {
  constructor(private readonly liveVideo: LiveVideoService) {}

  @Get("sessions/active")
  @RequirePermissions("incident:read")
  active(@Req() request: any) {
    return this.liveVideo.activeSessions(request.user);
  }

  @Post("incidents/:incidentId/start")
  @RequirePermissions("incident:create")
  start(@Param("incidentId") incidentId: string, @Body() dto: StartLiveVideoDto, @Req() request: any) {
    return this.liveVideo.startIncidentLiveVideo(incidentId, dto, request.user);
  }

  @Patch("sessions/:sessionId/stop")
  @RequirePermissions("incident:read")
  stop(@Param("sessionId") sessionId: string, @Req() request: any) {
    return this.liveVideo.stopIncidentLiveVideo(sessionId, request.user);
  }

  @Post("sessions/:sessionId/admin-token")
  @RequirePermissions("incident:read")
  adminToken(@Param("sessionId") sessionId: string, @Req() request: any) {
    return this.liveVideo.adminViewToken(sessionId, request.user);
  }

  @Patch("sessions/:sessionId/evidence")
  @RequirePermissions("incident:update")
  linkEvidence(@Param("sessionId") sessionId: string, @Body() dto: LinkLiveVideoEvidenceDto, @Req() request: any) {
    return this.liveVideo.linkEvidence(sessionId, dto, request.user);
  }

  @Post("sessions/:sessionId/location")
  @RequirePermissions("incident:read")
  addLocation(@Param("sessionId") sessionId: string, @Body() dto: LiveVideoLocationUpdateDto, @Req() request: any) {
    return this.liveVideo.addLocationUpdate(sessionId, dto, request.user);
  }

  @Get("sessions/:sessionId/location/latest")
  @RequirePermissions("incident:read")
  latestLocation(@Param("sessionId") sessionId: string, @Req() request: any) {
    return this.liveVideo.latestLocation(sessionId, request.user);
  }

  @Get("sessions/:sessionId/location/history")
  @RequirePermissions("incident:read")
  locationHistory(@Param("sessionId") sessionId: string, @Req() request: any) {
    return this.liveVideo.locationHistory(sessionId, request.user);
  }

  @Get("sessions/:sessionId/location/open/:token")
  @RequirePermissions("incident:read")
  openLocation(@Param("sessionId") sessionId: string, @Param("token") token: string, @Req() request: any) {
    return this.liveVideo.openLiveLocation(sessionId, token, request.user);
  }
}
