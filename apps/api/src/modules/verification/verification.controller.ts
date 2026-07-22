import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { AdminVerificationReviewDto, CrowdRequestDto, VerifyIncidentDto, WitnessConfirmationDto } from "./dto/verification.dto";
import { VerificationService } from "./verification.service";

@ApiTags("verification")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("verification")
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post("incidents/:id/run")
  @RequirePermissions("incident:read")
  run(@Param("id") id: string, @Body() dto: VerifyIncidentDto, @Req() request: any) {
    return this.verificationService.verifyIncident(id, dto, request.user);
  }

  @Get("incidents/:id/duplicates")
  @RequirePermissions("incident:read")
  duplicates(@Param("id") id: string, @Query("radiusMeters") radiusMeters?: string) {
    return this.verificationService.detectDuplicates(id, radiusMeters ? Number(radiusMeters) : undefined);
  }

  @Post("incidents/:id/crowd-request")
  @RequirePermissions("incident:read")
  crowdRequest(@Param("id") id: string, @Body() dto: CrowdRequestDto, @Req() request: any) {
    return this.verificationService.requestCrowdConfirmation(id, dto, request.user);
  }

  @Get("incidents/:id/confirmations")
  @RequirePermissions("incident:read")
  confirmations(@Param("id") id: string) {
    return this.verificationService.listWitnessConfirmations(id);
  }

  @Post("incidents/:id/confirm")
  @RequirePermissions("incident:read")
  confirm(@Param("id") id: string, @Body() dto: WitnessConfirmationDto, @Req() request: any) {
    return this.verificationService.submitWitnessConfirmation(id, dto, request.user);
  }

  @Post("incidents/:id/admin-review")
  @RequirePermissions("incident:update")
  adminReview(@Param("id") id: string, @Body() dto: AdminVerificationReviewDto, @Req() request: any) {
    return this.verificationService.adminReviewIncident(id, dto, request.user);
  }

  @Get("dashboard")
  @RequirePermissions("incident:read")
  dashboard() {
    return this.verificationService.dashboard();
  }
}
