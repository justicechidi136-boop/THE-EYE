import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
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
    return this.smartwatch.adminDevice(id, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get("admin/firmware")
  @RequirePermissions("user:manage")
  listAdminFirmware(@Req() request: any) {
    return this.smartwatch.listAdminFirmware(request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post("devices/:id/revoke")
  @RequirePermissions("user:manage")
  revokeDevice(@Param("id") id: string, @Body() dto: { reason?: string }, @Req() request: any) {
    return this.smartwatch.revokeDevice(id, request.user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post("admin/devices/:id/actions/:action")
  @RequirePermissions("user:manage")
  adminDeviceAction(
    @Param("id") id: string,
    @Param("action") action: string,
    @Body() dto: { reason?: string; note?: string },
    @Req() request: any,
  ) {
    return this.smartwatch.adminDeviceAction(id, action, dto, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get("admin/devices/:id/audit")
  @RequirePermissions("user:manage")
  adminDeviceAudit(@Param("id") id: string, @Req() request: any) {
    return this.smartwatch.adminDeviceAudit(id, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get("admin/devices/:id/telemetry")
  @RequirePermissions("user:manage")
  adminDeviceTelemetry(@Param("id") id: string, @Req() request: any) {
    return this.smartwatch.adminDeviceTelemetry(id, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get("admin/devices/:id/active-incident")
  @RequirePermissions("user:manage")
  adminDeviceActiveIncident(@Param("id") id: string, @Req() request: any) {
    return this.smartwatch.adminDeviceActiveIncident(id, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get("admin/devices/:id/emergency-history")
  @RequirePermissions("user:manage")
  adminDeviceEmergencyHistory(@Param("id") id: string, @Req() request: any) {
    return this.smartwatch.adminDeviceEmergencyHistory(id, request.user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post("devices/:deviceId/telemetry")
  recordTelemetry(@Param("deviceId") deviceId: string, @Body() dto: SmartwatchHeartbeatDto, @Req() request: any) {
    return this.smartwatch.recordTelemetry(deviceId, dto, request.user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post("devices/:deviceId/push-tokens")
  registerDevicePushToken(
    @Param("deviceId") deviceId: string,
    @Body() dto: { deviceSecret: string; token: string; platform?: string; provider?: string; appEnvironment?: string },
  ) {
    return this.smartwatch.registerDevicePushToken(deviceId, dto);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Patch("devices/:deviceId/push-tokens/deactivate")
  deactivateDevicePushTokens(
    @Param("deviceId") deviceId: string,
    @Body() dto: { deviceSecret: string },
  ) {
    return this.smartwatch.deactivateDevicePushTokens(deviceId, dto);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Patch("devices/:deviceId/notifications/:notificationId/ack")
  acknowledgeNotificationForDevice(
    @Param("deviceId") deviceId: string,
    @Param("notificationId") notificationId: string,
    @Body() dto: { deviceSecret: string; source?: "foreground" | "background" | "opened" | "watch_ack" },
  ) {
    return this.smartwatch.acknowledgeNotificationForDevice(deviceId, notificationId, dto);
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
  @Post("devices/:deviceId/version-policy")
  versionPolicy(
    @Param("deviceId") deviceId: string,
    @Body() dto: { deviceSecret?: string; currentVersion?: string; versionCode?: number; targetType?: string; environment?: string },
    @Req() request: any,
  ) {
    return this.smartwatch.versionPolicy(deviceId, dto, request.user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get("devices/:deviceId/notifications")
  listDeviceNotifications(
    @Param("deviceId") deviceId: string,
    @Req() request: any,
  ) {
    const deviceSecret = request.query?.deviceSecret as string | undefined;
    return this.smartwatch.listDeviceNotifications(deviceId, { deviceSecret }, {
      cursor: request.query?.cursor as string | undefined,
      limit: request.query?.limit as string | undefined,
    });
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Patch("devices/:deviceId/notifications/:notificationId/read")
  markNotificationRead(
    @Param("deviceId") deviceId: string,
    @Param("notificationId") notificationId: string,
    @Body() dto: { deviceSecret: string },
  ) {
    return this.smartwatch.markNotificationReadForDevice(deviceId, notificationId, dto);
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
