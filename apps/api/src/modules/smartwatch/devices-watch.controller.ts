import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { OptionalJwtAuthGuard } from "../../common/auth/optional-jwt-auth.guard";
import { resolveWatchFeatureFlags } from "../../common/feature-flags/watch-feature-flags";
import { WatchAlertTelemetryService } from "../danger-zones/watch-alert-telemetry.service";
import type { SmartwatchGpsDto, SmartwatchHeartbeatDto } from "../smartwatch/dto/smartwatch.dto";
import { SmartwatchService } from "../smartwatch/smartwatch.service";

@ApiTags("devices-watch")
@Controller("devices/watch")
export class DevicesWatchController {
  constructor(
    private readonly smartwatch: SmartwatchService,
    private readonly config: ConfigService,
    private readonly telemetry: WatchAlertTelemetryService,
  ) {}
  @UseGuards(OptionalJwtAuthGuard)
  @Post("location")
  location(@Body() dto: SmartwatchGpsDto & { deviceId?: string }, @Req() request: any) {
    if (!dto.deviceId) throw new BadRequestException("deviceId is required");
    return this.smartwatch.recordGps(dto.deviceId, dto, request.user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post("heartbeat")
  heartbeat(@Body() dto: SmartwatchHeartbeatDto, @Req() request: any) {
    if (!dto.deviceId) throw new BadRequestException("deviceId is required");
    return this.smartwatch.heartbeat(dto.deviceId, dto, request.user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post("alerts/:alertId/acknowledge")
  acknowledge(@Param("alertId") alertId: string, @Body() dto: { deviceId?: string; deviceSecret?: string }, @Req() request: any) {
    if (!dto.deviceId) throw new BadRequestException("deviceId is required");
    return this.smartwatch.acknowledgeSafetyAlert(alertId, dto.deviceId, dto, request.user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get("accessibility-preferences")
  getAccessibilityPreferences(
    @Query("deviceId") deviceId: string,
    @Query("deviceSecret") deviceSecret: string | undefined,
    @Req() request: any,
  ) {
    if (!deviceId) throw new BadRequestException("deviceId is required");
    return this.smartwatch.getAccessibilityPreferences(deviceId, deviceSecret, request.user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Patch("accessibility-preferences")
  updateAccessibilityPreferences(
    @Body() dto: { deviceId?: string; deviceSecret?: string; preferences?: Record<string, unknown> },
    @Req() request: any,
  ) {
    if (!dto.deviceId) throw new BadRequestException("deviceId is required");
    return this.smartwatch.updateAccessibilityPreferences(
      dto.deviceId,
      (dto.preferences ?? {}) as never,
      dto.deviceSecret,
      request.user,
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get("feature-flags")
  featureFlags() {
    return resolveWatchFeatureFlags(this.config as unknown as Record<string, unknown>);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post("telemetry")
  recordTelemetry(
    @Body()
    dto: {
      safetyAlertId: string;
      deviceId?: string;
      event: string;
      channel?: string;
      language?: string;
      reason?: string;
      metadata?: Record<string, unknown>;
    },
    @Req() request: any,
  ) {
    if (!dto.safetyAlertId || !dto.event) throw new BadRequestException("safetyAlertId and event are required");
    return this.telemetry.record({
      safetyAlertId: dto.safetyAlertId,
      userId: request.user?.sub,
      deviceId: dto.deviceId,
      event: dto.event as any,
      channel: dto.channel,
      language: dto.language,
      reason: dto.reason,
      metadata: dto.metadata,
    });
  }
}
