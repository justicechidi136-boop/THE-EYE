import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/auth/optional-jwt-auth.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import {
  RegisterSmartwatchDeviceDto,
  SendCriticalAlertDto,
  SmartwatchFirmwareReleaseDto,
  SmartwatchGpsDto,
  SmartwatchHeartbeatDto,
  SmartwatchOfflineSyncDto,
  SmartwatchSosDto,
  SmartwatchStandaloneLoginDto,
  UpdateSmartwatchStatusDto,
  IssueSmartwatchPairingCodeDto,
  AdminIssueSmartwatchActivationDto,
  ActivateWatchWithCodeDto,
  RegenerateWatchActivationCodeDto,
} from "./dto/smartwatch.dto";
import { SmartwatchService } from "./smartwatch.service";

@ApiTags("smartwatch-sos")
@Controller("smartwatch")
export class SmartwatchController {
  constructor(private readonly smartwatch: SmartwatchService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post("devices/register")
  @RequirePermissions("incident:create")
  registerDevice(@Body() dto: RegisterSmartwatchDeviceDto, @Req() request: any) {
    return this.smartwatch.registerDevice(dto, request.user);
  }

  @Post("devices/pairing-codes")
  @RateLimit("auth")
  issuePairingCode(@Body() dto: IssueSmartwatchPairingCodeDto) {
    return this.smartwatch.issuePairingCode(dto);
  }

  @Get("devices/:deviceId/pairing-status")
  getPairingStatus(@Param("deviceId") deviceId: string) {
    return this.smartwatch.getPairingStatus(deviceId);
  }

  @Post("devices/standalone-login")
  @RateLimit("auth")
  standaloneLogin(@Body() dto: SmartwatchStandaloneLoginDto) {
    return this.smartwatch.standaloneLogin(dto);
  }

  @Post("devices/activate-with-code")
  @RateLimit("auth")
  activateWithCode(@Body() dto: ActivateWatchWithCodeDto) {
    return this.smartwatch.activateWithCode(dto);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post("devices/:deviceId/activation-code/regenerate")
  @RateLimit("auth")
  regenerateActivationCode(
    @Param("deviceId") deviceId: string,
    @Body() dto: RegenerateWatchActivationCodeDto,
    @Req() request: any,
  ) {
    return this.smartwatch.regenerateActivationCode(deviceId, dto ?? {}, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get("devices")
  @RequirePermissions("incident:read")
  listMyDevices(@Req() request: any) {
    return this.smartwatch.listMyDevices(request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch("devices/:id/status")
  @RequirePermissions("incident:read")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateSmartwatchStatusDto, @Req() request: any) {
    return this.smartwatch.updateDeviceStatus(id, dto, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch("devices/:id/unpair")
  @RequirePermissions("incident:read")
  unpair(@Param("id") id: string, @Req() request: any) {
    return this.smartwatch.unpairDevice(id, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch("devices/:id/activate")
  @RequirePermissions("user:manage")
  activate(@Param("id") id: string, @Req() request: any) {
    return this.smartwatch.activateDevice(id, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch("devices/:id/deactivate")
  @RequirePermissions("user:manage")
  deactivate(@Param("id") id: string, @Req() request: any) {
    return this.smartwatch.deactivateDevice(id, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch("devices/:id/remote-wipe")
  @RequirePermissions("user:manage")
  remoteWipe(@Param("id") id: string, @Req() request: any) {
    return this.smartwatch.remoteWipe(id, request.user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post("devices/:deviceId/heartbeat")
  heartbeat(@Param("deviceId") deviceId: string, @Body() dto: SmartwatchHeartbeatDto, @Req() request: any) {
    return this.smartwatch.heartbeat(deviceId, dto, request.user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post("devices/:deviceId/gps")
  recordGps(@Param("deviceId") deviceId: string, @Body() dto: SmartwatchGpsDto, @Req() request: any) {
    return this.smartwatch.recordGps(deviceId, dto, request.user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @RateLimit("sos")
  @Post("sos")
  triggerSos(@Body() dto: SmartwatchSosDto, @Req() request: any) {
    return this.smartwatch.triggerSos(dto, request.user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post("devices/:deviceId/offline-sync")
  offlineSync(@Param("deviceId") deviceId: string, @Body() dto: SmartwatchOfflineSyncDto, @Req() request: any) {
    return this.smartwatch.syncOfflineEvents(deviceId, dto, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get("sos/:sosEventId/tracking")
  @RequirePermissions("incident:read")
  emergencyTracking(@Param("sosEventId") sosEventId: string, @Req() request: any) {
    return this.smartwatch.emergencyTracking(sosEventId, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get("admin/sos-events")
  @RequirePermissions("incident:read")
  adminSosEvents(@Req() request: any) {
    return this.smartwatch.adminSosEvents(request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get("admin/devices")
  @RequirePermissions("user:manage")
  adminDevices(@Req() request: any) {
    return this.smartwatch.adminDevices(request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get("admin/devices/:id")
  @RequirePermissions("user:manage")
  adminDevice(@Param("id") id: string, @Req() request: any) {
    return this.smartwatch.adminGetDevice(id, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get("admin/firmware")
  @RequirePermissions("user:manage")
  adminListFirmware(@Req() request: any) {
    return this.smartwatch.adminListFirmware(request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get("admin/pairing-sessions")
  @RequirePermissions("user:manage")
  adminPairingSessions(@Req() request: any) {
    return this.smartwatch.adminListPairingSessions(request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get("admin/activation-history")
  @RequirePermissions("user:manage")
  adminActivationHistory(@Req() request: any) {
    return this.smartwatch.adminActivationHistory(request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post("admin/activation-secrets")
  @RequirePermissions("user:manage")
  adminIssueActivation(@Body() dto: AdminIssueSmartwatchActivationDto, @Req() request: any) {
    return this.smartwatch.adminIssueActivation(dto, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Delete("admin/pairing-sessions/:deviceId")
  @RequirePermissions("user:manage")
  adminRevokePairingSession(@Param("deviceId") deviceId: string, @Req() request: any) {
    return this.smartwatch.adminRevokePairingSession(deviceId, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post("devices/:id/critical-alert")
  @RequirePermissions("broadcast:publish")
  criticalAlert(@Param("id") id: string, @Body() dto: SendCriticalAlertDto, @Req() request: any) {
    return this.smartwatch.sendCriticalAlert(id, dto, request.user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post("devices/:deviceId/firmware/check")
  firmwareCheck(@Param("deviceId") deviceId: string, @Body() dto: { deviceSecret?: string; currentVersion?: string }, @Req() request: any) {
    return this.smartwatch.firmwareCheck(deviceId, dto, request.user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post("devices/:deviceId/firmware/:version/download")
  firmwareDownload(@Param("deviceId") deviceId: string, @Param("version") version: string, @Body() dto: { deviceSecret?: string }, @Req() request: any) {
    return this.smartwatch.firmwareDownload(deviceId, version, dto, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post("admin/firmware")
  @RequirePermissions("user:manage")
  publishFirmware(@Body() dto: SmartwatchFirmwareReleaseDto, @Req() request: any) {
    return this.smartwatch.publishFirmware(dto, request.user);
  }
}
