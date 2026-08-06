import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/auth/optional-jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { FieldAuthService } from "./field-auth.service";
import { FieldDevicesAdminService } from "./field-devices-admin.service";
import { FieldDevicesService } from "./field-devices.service";
import type {
  CompleteFieldPairingDto,
  FieldDeviceAdminActionDto,
  FieldDeviceHeartbeatDto,
  FieldLoginDto,
  FieldRefreshDto,
  RegisterFieldDeviceDto,
} from "./dto/field-devices.dto";

@ApiTags("field-devices")
@Controller("field/devices")
export class FieldDevicesController {
  constructor(private readonly devices: FieldDevicesService) {}

  @Post("challenge")
  @RateLimit("authLogin")
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
  @RateLimit("authLogin")
  completePairing(@Body() dto: CompleteFieldPairingDto) {
    return this.devices.completePairing(dto);
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
  @RateLimit("authLogin")
  login(@Body() dto: FieldLoginDto) {
    return this.auth.login(dto);
  }

  @Post("refresh")
  @RateLimit("authLogin")
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
  constructor(private readonly admin: FieldDevicesAdminService) {}

  @Get()
  @RequirePermissions("field:device:manage")
  list(@Req() request: { user: unknown }, @Query("status") status?: string, @Query("agencyId") agencyId?: string, @Query("limit") limit?: string) {
    return this.admin.list(request.user as never, { status, agencyId, limit });
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
