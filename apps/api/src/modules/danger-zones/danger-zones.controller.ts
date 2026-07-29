import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { DangerZonesService } from "./danger-zones.service";
import type { AllClearDangerZoneDto, CreateDangerZoneDto, UpdateDangerZoneDto } from "./dto/danger-zone.dto";

@ApiTags("danger-zones")
@Controller()
export class DangerZonesController {
  constructor(private readonly dangerZones: DangerZonesService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post("danger-zones")
  @RequirePermissions("broadcast:publish")
  create(@Body() dto: CreateDangerZoneDto, @Req() request: any) {
    return this.dangerZones.create(dto, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get("danger-zones")
  @RequirePermissions("incident:read")
  list(@Req() request: any) {
    return this.dangerZones.list(request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get("danger-zones/:id")
  @RequirePermissions("incident:read")
  get(@Param("id") id: string, @Req() request: any) {
    return this.dangerZones.get(id, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch("danger-zones/:id")
  @RequirePermissions("broadcast:publish")
  update(@Param("id") id: string, @Body() dto: UpdateDangerZoneDto, @Req() request: any) {
    return this.dangerZones.update(id, dto, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post("danger-zones/:id/activate")
  @RequirePermissions("broadcast:publish")
  activate(@Param("id") id: string, @Req() request: any) {
    return this.dangerZones.activate(id, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post("danger-zones/:id/contain")
  @RequirePermissions("broadcast:publish")
  contain(@Param("id") id: string, @Req() request: any) {
    return this.dangerZones.contain(id, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post("danger-zones/:id/expand")
  @RequirePermissions("broadcast:publish")
  expand(@Param("id") id: string, @Body() dto: UpdateDangerZoneDto, @Req() request: any) {
    return this.dangerZones.expand(id, dto, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post("danger-zones/:id/all-clear")
  @RequirePermissions("broadcast:publish")
  allClear(@Param("id") id: string, @Body() dto: AllClearDangerZoneDto, @Req() request: any) {
    return this.dangerZones.allClear(id, dto, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post("danger-zones/:id/cancel")
  @RequirePermissions("broadcast:publish")
  cancel(@Param("id") id: string, @Body() body: { reason?: string }, @Req() request: any) {
    return this.dangerZones.cancel(id, body.reason ?? "Cancelled by administrator", request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("users/me/nearby-threats")
  nearbyThreats(@Query("latitude") latitude: string, @Query("longitude") longitude: string, @Req() request: any) {
    return this.dangerZones.nearbyThreats(request.user.sub, Number(latitude), Number(longitude));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get("admin/danger-zones/:id/delivery")
  @RequirePermissions("incident:read")
  delivery(@Param("id") id: string, @Req() request: any) {
    return this.dangerZones.deliveryStats(id, request.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get("admin/danger-zones/:id/affected-devices")
  @RequirePermissions("incident:read")
  affectedDevices(@Param("id") id: string, @Req() request: any) {
    return this.dangerZones.affectedDevices(id, request.user);
  }
}
