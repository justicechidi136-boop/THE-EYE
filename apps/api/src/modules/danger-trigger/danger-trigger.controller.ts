import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { DangerTriggerService } from "./danger-trigger.service";
import type {
  ActivateDangerTriggerDto,
  CancelDangerTriggerDto,
  StartDangerTriggerDto,
} from "./dto/danger-trigger.dto";

@ApiTags("danger-trigger")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("danger-triggers")
export class DangerTriggerController {
  constructor(private readonly dangerTrigger: DangerTriggerService) {}

  @Post("live-voice/prepare")
  @RateLimit("liveStreamCreate")
  @RequirePermissions("incident:create")
  prepare(@Body() dto: StartDangerTriggerDto, @Req() request: any) {
    return this.dangerTrigger.prepareLiveVoice(dto, request.user, {
      requestId: String(request.headers["x-request-id"] ?? ""),
      clientTraceId: String(request.headers["x-client-trace-id"] ?? ""),
    });
  }

  @Post(":eventId/activate")
  @RateLimit("liveStreamCreate")
  @RequirePermissions("incident:create")
  activate(@Param("eventId") eventId: string, @Body() dto: ActivateDangerTriggerDto, @Req() request: any) {
    return this.dangerTrigger.activate(eventId, dto, request.user);
  }

  @Patch(":eventId/end-live-voice")
  @RequirePermissions("incident:create")
  stop(@Param("eventId") eventId: string, @Req() request: any) {
    return this.dangerTrigger.stopLiveVoice(eventId, request.user);
  }

  @Patch(":eventId/cancel")
  @RequirePermissions("incident:create")
  cancel(@Param("eventId") eventId: string, @Body() dto: CancelDangerTriggerDto, @Req() request: any) {
    return this.dangerTrigger.cancel(eventId, dto, request.user);
  }

  @Get("area-risk")
  @RequirePermissions("incident:read")
  areaRisk(@Query("latitude") latitude: string, @Query("longitude") longitude: string, @Req() request: any) {
    return this.dangerTrigger.areaRisk(Number(latitude), Number(longitude), request.user);
  }

  @Get(":eventId")
  @RequirePermissions("incident:read")
  detail(@Param("eventId") eventId: string, @Req() request: any) {
    return this.dangerTrigger.detail(eventId, request.user);
  }

  @Post(":eventId/listen-token")
  @RequirePermissions("incident:read")
  listen(@Param("eventId") eventId: string, @Req() request: any) {
    return this.dangerTrigger.listenerToken(eventId, request.user);
  }
}
