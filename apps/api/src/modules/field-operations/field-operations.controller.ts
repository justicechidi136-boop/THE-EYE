import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/auth/optional-jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { FieldAuthService } from "./field-auth.service";
import { FieldDevicePairingService } from "./field-device-pairing.service";
import { FieldDevicesAdminService } from "./field-devices-admin.service";
import { FieldDevicesService } from "./field-devices.service";
import { FieldLauncherPolicyService, type LauncherPolicyPatch } from "./field-launcher-policy.service";
import type {
  CompleteFieldPairingDto,
  FieldDeviceAdminActionDto,
  FieldDeviceHeartbeatDto,
  FieldLoginDto,
  FieldRefreshDto,
  RegisterFieldDeviceDto,
  RegisterFieldPushTokenDto,
} from "./dto/field-devices.dto";

@ApiTags("field-devices")
@Controller("field/devices")
export class FieldDevicesController {
  constructor(
    private readonly devices: FieldDevicesService,
    private readonly launcherPolicy: FieldLauncherPolicyService,
    private readonly pairing: FieldDevicePairingService,
  ) {}

  @Post("challenge")
  @RateLimit("auth")
  createChallenge() {
    return this.devices.createRegistrationChallenge();
  }

  @Post("register")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("field:device:register")
  @ApiBearerAuth()
  register(@Req() request: { user: unknown }, @Body() dto: RegisterFieldDeviceDto) {
    return this.devices.registerDevice(request.user as never, dto);
  }

  @Get("registration-status")
  registrationStatus(@Query("publicDeviceId") publicDeviceId?: string, @Query("installationIdHash") installationIdHash?: string) {
    return this.devices.getRegistrationStatus({ publicDeviceId, installationIdHash });
  }

  @Post("complete-pairing")
  @RateLimit("auth")
  completePairing(@Body() dto: CompleteFieldPairingDto) {
    return this.devices.completePairing(dto);
  }

  @Get("me/policy")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  myPolicy(@Req() request: { user: unknown }) {
    return this.launcherPolicy.getPolicyForFieldSession(request.user as never);
  }

  @Post("me/launcher-audit")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @RateLimit("auth")
  launcherAudit(
    @Req() request: { user: unknown },
    @Body() body: { action?: string; packageName?: string; ok?: boolean; environment?: string },
  ) {
    return this.launcherPolicy.recordLauncherAudit(request.user as never, body);
  }

  @Post("me/push-token")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  registerPushToken(@Req() request: { user: unknown }, @Body() dto: RegisterFieldPushTokenDto) {
    return this.devices.registerPushToken(request.user as never, dto);
  }

  @Post("me/push-token/deactivate")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  deactivatePushTokens(@Req() request: { user: unknown }) {
    return this.devices.deactivatePushTokens(request.user as never);
  }

  @Post("me/activation-code/regenerate")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @RateLimit("fieldPairing")
  regenerateMyActivationCode(@Req() request: { user: unknown }, @Body() dto: { ttlMinutes?: number }) {
    return this.pairing.regenerateForAuthenticatedDevice(request.user as never, dto ?? {});
  }

  @Post(":publicDeviceId/heartbeat")
  @UseGuards(OptionalJwtAuthGuard)
  heartbeat(@Param("publicDeviceId") publicDeviceId: string, @Body() dto: FieldDeviceHeartbeatDto, @Req() request: { user?: unknown }) {
    return this.devices.heartbeat(publicDeviceId, dto, request.user as never);
  }
}

@ApiTags("field-auth")
@Controller("field/auth")
export class FieldAuthController {
  constructor(private readonly auth: FieldAuthService) {}

  @Post("login")
  @RateLimit("auth")
  login(@Body() dto: FieldLoginDto) {
    return this.auth.login(dto);
  }

  @Post("refresh")
  @RateLimit("auth")
  refresh(@Body() dto: FieldRefreshDto) {
    return this.auth.refresh(dto);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  logout(@Req() request: { user: unknown }) {
    return this.auth.logout(request.user as never);
  }

  @Post("lock")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  lock(@Req() request: { user: unknown }) {
    return this.auth.lock(request.user as never);
  }

  @Post("unlock")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  unlock(@Req() request: { user: unknown }) {
    return this.auth.unlock(request.user as never);
  }

  @Get("session")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  session(@Req() request: { user: unknown }) {
    return this.auth.getSession(request.user as never);
  }
}

@ApiTags("admin-field-devices")
@Controller("admin/field-devices")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldDevicesAdminController {
  constructor(
    private readonly admin: FieldDevicesAdminService,
    private readonly launcherPolicy: FieldLauncherPolicyService,
  ) {}

  @Get()
  @RequirePermissions("field:device:manage")
  list(@Req() request: { user: unknown }, @Query("status") status?: string, @Query("agencyId") agencyId?: string, @Query("limit") limit?: string) {
    return this.admin.list(request.user as never, { status, agencyId, limit });
  }

  @Get(":id/policy")
  @RequirePermissions("field:device:manage")
  getPolicy(@Param("id") id: string, @Req() request: { user: unknown }) {
    return this.launcherPolicy.getPolicyForAdmin(id, request.user as never);
  }

  @Patch(":id/policy")
  @RequirePermissions("field:device:manage")
  patchPolicy(@Param("id") id: string, @Req() request: { user: unknown }, @Body() dto: LauncherPolicyPatch) {
    return this.launcherPolicy.patchPolicyForAdmin(id, request.user as never, dto);
  }

  @Get(":id")
  @RequirePermissions("field:device:manage")
  get(@Param("id") id: string, @Req() request: { user: unknown }) {
    return this.admin.get(id, request.user as never);
  }

  @Post(":id/approve")
  @RequirePermissions("field:device:approve")
  approve(@Param("id") id: string, @Req() request: { user: unknown }, @Body() dto: FieldDeviceAdminActionDto) {
    return this.admin.approve(id, request.user as never, dto);
  }

  @Post(":id/reject")
  @RequirePermissions("field:device:approve")
  reject(@Param("id") id: string, @Req() request: { user: unknown }, @Body() dto: FieldDeviceAdminActionDto) {
    return this.admin.reject(id, request.user as never, dto);
  }

  @Post(":id/suspend")
  @RequirePermissions("field:device:approve")
  suspend(@Param("id") id: string, @Req() request: { user: unknown }, @Body() dto: FieldDeviceAdminActionDto) {
    return this.admin.suspend(id, request.user as never, dto);
  }

  @Post(":id/restore")
  @RequirePermissions("field:device:approve")
  restore(@Param("id") id: string, @Req() request: { user: unknown }, @Body() dto: FieldDeviceAdminActionDto) {
    return this.admin.restore(id, request.user as never, dto);
  }

  @Post(":id/mark-lost")
  @RequirePermissions("field:device:approve")
  markLost(@Param("id") id: string, @Req() request: { user: unknown }, @Body() dto: FieldDeviceAdminActionDto) {
    return this.admin.markLost(id, request.user as never, dto);
  }

  @Post(":id/revoke")
  @RequirePermissions("field:device:approve")
  revoke(@Param("id") id: string, @Req() request: { user: unknown }, @Body() dto: FieldDeviceAdminActionDto) {
    return this.admin.revoke(id, request.user as never, dto);
  }

  @Post(":id/require-re-pair")
  @RequirePermissions("field:device:approve")
  requireRePair(@Param("id") id: string, @Req() request: { user: unknown }, @Body() dto: FieldDeviceAdminActionDto) {
    return this.admin.requireRePair(id, request.user as never, dto);
  }

  @Post(":id/force-sign-out")
  @RequirePermissions("field:device:approve")
  forceSignOut(@Param("id") id: string, @Req() request: { user: unknown }, @Body() dto: FieldDeviceAdminActionDto) {
    return this.admin.forceSignOut(id, request.user as never, dto);
  }
}
