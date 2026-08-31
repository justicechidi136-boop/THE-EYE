import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import {
  AdminBroadcastCommentDto,
  AdminBroadcastListQuery,
  AdminModerationReasonDto,
  BroadcastAdminService,
} from "./broadcast-admin.service";
import { CreateBroadcastDto } from "./dto/broadcast.dto";

@ApiTags("admin-broadcasts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/broadcasts")
export class AdminBroadcastsController {
  constructor(private readonly broadcastAdmin: BroadcastAdminService) {}

  @Get()
  @RequirePermissions("broadcast:create")
  list(@Req() request: any, @Query() query: AdminBroadcastListQuery) {
    return this.broadcastAdmin.list(request.user, query);
  }

  @Get("target-options")
  @RequirePermissions("broadcast:create")
  targetOptions(@Req() request: any) {
    return this.broadcastAdmin.targetOptions(request.user);
  }

  @Get(":id")
  @RequirePermissions("broadcast:create")
  getDetail(@Param("id") id: string, @Req() request: any) {
    return this.broadcastAdmin.getDetail(id, request.user);
  }

  @Get(":id/media/:mediaId/view")
  @RequirePermissions("broadcast:create")
  viewMedia(@Param("id") id: string, @Param("mediaId") mediaId: string, @Req() request: any) {
    return this.broadcastAdmin.viewMedia(id, mediaId, request.user);
  }

  @Post()
  @RateLimit("broadcastCreate")
  @RequirePermissions("broadcast:create")
  create(@Body() dto: CreateBroadcastDto, @Req() request: any) {
    return this.broadcastAdmin.create(dto, request.user);
  }

  @Patch(":id")
  @RequirePermissions("broadcast:publish")
  patch(@Param("id") id: string, @Body() dto: Partial<CreateBroadcastDto>, @Req() request: any) {
    return this.broadcastAdmin.patch(id, dto, request.user);
  }

  @Post(":id/suspend")
  @RequirePermissions("broadcast:publish")
  suspend(@Param("id") id: string, @Body() dto: AdminModerationReasonDto, @Req() request: any) {
    return this.broadcastAdmin.suspend(id, request.user, dto);
  }

  @Post(":id/restore")
  @RequirePermissions("broadcast:publish")
  restore(@Param("id") id: string, @Req() request: any) {
    return this.broadcastAdmin.restore(id, request.user);
  }

  @Delete(":id")
  @RequirePermissions("broadcast:publish")
  softDelete(@Param("id") id: string, @Body() dto: AdminModerationReasonDto, @Req() request: any) {
    return this.broadcastAdmin.softDelete(id, request.user, dto);
  }

  @Post(":id/verify")
  @RequirePermissions("broadcast:publish")
  verify(@Param("id") id: string, @Body() dto: AdminModerationReasonDto, @Req() request: any) {
    return this.broadcastAdmin.verify(id, request.user, dto);
  }

  @Post(":id/resolve")
  @RequirePermissions("broadcast:publish")
  resolve(@Param("id") id: string, @Body() dto: AdminModerationReasonDto, @Req() request: any) {
    return this.broadcastAdmin.resolve(id, request.user, dto);
  }

  @Post(":id/comments")
  @RequirePermissions("broadcast:publish")
  comment(@Param("id") id: string, @Body() dto: AdminBroadcastCommentDto, @Req() request: any) {
    return this.broadcastAdmin.addOfficialComment(id, request.user, dto);
  }

  @Get(":id/reports")
  @RequirePermissions("broadcast:create")
  reports(@Param("id") id: string, @Req() request: any) {
    return this.broadcastAdmin.listReports(id, request.user);
  }
}
