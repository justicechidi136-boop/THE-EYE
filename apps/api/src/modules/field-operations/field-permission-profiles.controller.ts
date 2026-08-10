import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { FieldPermissionProfilesService } from "./field-permission-profiles.service";
import type {
  CreateFieldPermissionProfileDto,
  DisableFieldPermissionProfileDto,
  FieldPermissionEffectivePreviewQuery,
  FieldPermissionProfileListQuery,
  UpdateFieldPermissionProfileDto,
} from "./dto/field-permission-profiles.dto";

@ApiTags("admin-field-permission-profiles")
@Controller("admin/field-permission-profiles")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldPermissionProfilesAdminController {
  constructor(private readonly profiles: FieldPermissionProfilesService) {}

  @Get()
  @RequirePermissions("field:device:manage")
  list(@Req() request: { user: unknown }, @Query() query: FieldPermissionProfileListQuery) {
    return this.profiles.list(request.user as never, query);
  }

  @Get(":id")
  @RequirePermissions("field:device:manage")
  get(@Param("id") id: string, @Req() request: { user: unknown }) {
    return this.profiles.get(id, request.user as never);
  }

  @Post()
  @RequirePermissions("field:device:approve")
  create(@Req() request: { user: unknown }, @Body() dto: CreateFieldPermissionProfileDto) {
    return this.profiles.create(request.user as never, dto);
  }

  @Patch(":id")
  @RequirePermissions("field:device:approve")
  update(@Param("id") id: string, @Req() request: { user: unknown }, @Body() dto: UpdateFieldPermissionProfileDto) {
    return this.profiles.update(id, request.user as never, dto);
  }

  @Post(":id/disable")
  @RequirePermissions("field:device:approve")
  disable(@Param("id") id: string, @Req() request: { user: unknown }, @Body() dto: DisableFieldPermissionProfileDto) {
    return this.profiles.disable(id, request.user as never, dto);
  }
}

@ApiTags("admin-field-permissions")
@Controller("admin/field-permissions")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldPermissionsAdminController {
  constructor(private readonly profiles: FieldPermissionProfilesService) {}

  @Get("effective-preview")
  @RequirePermissions("field:device:manage")
  effectivePreview(@Req() request: { user: unknown }, @Query() query: FieldPermissionEffectivePreviewQuery) {
    return this.profiles.previewEffective(request.user as never, query);
  }
}
