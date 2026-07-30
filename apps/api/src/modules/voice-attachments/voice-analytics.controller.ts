import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { VoiceAnalyticsService } from "./voice-analytics.service";

@Controller("admin/voice-analytics")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VoiceAnalyticsController {
  constructor(private readonly analytics: VoiceAnalyticsService) {}

  @Get()
  @RequirePermissions("audit:read")
  summary() {
    return this.analytics.getSummary();
  }
}
