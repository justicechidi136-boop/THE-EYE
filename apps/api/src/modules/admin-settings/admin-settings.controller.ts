import { Body, Controller, Get, Param, Patch, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { AdminSettingsService } from "./admin-settings.service";
import { UpdateAdminPreferencesDto, UpsertPolicyDto } from "./dto/admin-settings.dto";

@ApiTags("admin-settings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin")
export class AdminSettingsController {
  constructor(private readonly adminSettings: AdminSettingsService) {}

  @Get("policies")
  @RequirePermissions("policy:read")
  listPolicies(@Req() request: any, @Query("communityId") communityId?: string) {
    return this.adminSettings.listPolicies(request.user, communityId);
  }

  @Get("policies/:section")
  @RequirePermissions("policy:read")
  getPolicy(@Param("section") section: string, @Req() request: any, @Query("communityId") communityId?: string) {
    return this.adminSettings.getPolicy(section, request.user, communityId);
  }

  @Put("policies/:section")
  @RequirePermissions("policy:manage")
  upsertPolicy(@Param("section") section: string, @Body() dto: UpsertPolicyDto, @Req() request: any) {
    return this.adminSettings.upsertPolicy(section, dto, request.user);
  }

  @Get("preferences")
  @RequirePermissions("auth:admin")
  getPreferences(@Req() request: any) {
    return this.adminSettings.getPreferences(request.user);
  }

  @Patch("preferences")
  @RequirePermissions("auth:admin")
  updatePreferences(@Body() dto: UpdateAdminPreferencesDto, @Req() request: any) {
    return this.adminSettings.updatePreferences(request.user, dto);
  }
}
