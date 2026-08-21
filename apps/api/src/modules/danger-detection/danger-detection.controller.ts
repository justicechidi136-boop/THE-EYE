import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { DangerDetectionService } from "./danger-detection.service";

@ApiTags("danger-detection")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/danger-detection")
export class DangerDetectionController {
  constructor(private readonly dangerDetection: DangerDetectionService) {}

  @Get("review")
  @RequirePermissions("incident:read")
  listForReview(@Query("limit") limit?: string) {
    return this.dangerDetection.listForReview(Number(limit) || 50);
  }
}
