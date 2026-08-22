import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { RateLimitGuard } from "../../common/rate-limit/rate-limit.guard";
import { FieldDevicePreprovisionService } from "./field-device-preprovision.service";
import { FieldDevicePairingService } from "./field-device-pairing.service";
import { PreProvisionFieldDeviceDto, UpdateFieldDeviceProvisioningDto } from "./dto/field-device-preprovision.dto";
import type { CancelPairingDto, IssuePairingCodeDto } from "./dto/field-device-pairing.dto";

/**
 * Admin endpoints for pre-provisioning field devices and managing their secure
 * pairing lifecycle. Mounted at the same `admin/field-devices` prefix as
 * FieldDevicesAdminController (field-operations.controller.ts) — routes are
 * additive and do not overlap with existing approve/reject/suspend/etc paths.
 */
@ApiTags("admin-field-devices")
@Controller("admin/field-devices")
@UseGuards(JwtAuthGuard, PermissionsGuard, RateLimitGuard)
@ApiBearerAuth()
export class FieldDeviceProvisioningAdminController {
  constructor(
    private readonly preprovision: FieldDevicePreprovisionService,
    private readonly pairing: FieldDevicePairingService,
  ) {}

  @Post("preprovision")
  @RequirePermissions("field:device:approve")
  create(@Req() request: { user: unknown }, @Body() dto: PreProvisionFieldDeviceDto) {
    return this.preprovision.preprovision(request.user as never, dto);
  }

  @Get("assignable-users")
  @RequirePermissions("field:device:approve")
  listAssignableUsers(@Req() request: { user: unknown }, @Query("agencyId") agencyId?: string) {
    return this.preprovision.listAssignableUsers(request.user as never, agencyId);
  }

  @Get(":id/provisioning")
  @RequirePermissions("field:device:manage")
  getProvisioning(@Param("id") id: string, @Req() request: { user: unknown }) {
    return this.preprovision.getProvisioning(id, request.user as never);
  }

  @Patch(":id/provisioning")
  @RequirePermissions("field:device:approve")
  updateProvisioning(
    @Param("id") id: string,
    @Req() request: { user: unknown },
    @Body() dto: UpdateFieldDeviceProvisioningDto,
  ) {
    return this.preprovision.updateProvisioning(id, request.user as never, dto);
  }

  @Post(":id/pairing-code")
  @RequirePermissions("field:device:approve")
  @RateLimit("fieldPairing")
  issuePairingCode(@Param("id") id: string, @Req() request: { user: unknown }, @Body() dto: IssuePairingCodeDto) {
    return this.pairing.issuePairingCode(request.user as never, id, dto ?? {});
  }

  @Post(":id/cancel-pairing")
  @RequirePermissions("field:device:approve")
  cancelPairing(@Param("id") id: string, @Req() request: { user: unknown }, @Body() dto: CancelPairingDto) {
    return this.pairing.cancelPairing(request.user as never, id, dto ?? {});
  }

  @Post(":id/regenerate-pairing")
  @RequirePermissions("field:device:approve")
  @RateLimit("fieldPairing")
  regeneratePairing(@Param("id") id: string, @Req() request: { user: unknown }, @Body() dto: IssuePairingCodeDto) {
    return this.pairing.regeneratePairing(request.user as never, id, dto ?? {});
  }

  @Post(":id/recover-activation-lock")
  @RequirePermissions("field:device:approve")
  @RateLimit("fieldPairing")
  recoverActivationLock(@Param("id") id: string, @Req() request: { user: unknown }, @Body() dto: IssuePairingCodeDto) {
    return this.pairing.recoverActivationLock(request.user as never, id, dto ?? {});
  }
}
