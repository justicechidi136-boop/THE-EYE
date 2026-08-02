import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import {
  CreateDroneDeviceDto,
  CreateDroneGeofenceDto,
  CreateDroneMissionDto,
  CreateDroneNoFlyZoneDto,
  CreateDroneOperatorDto,
  LaunchMissionFromIncidentDto,
  LinkDroneEvidenceDto,
  UpdateDroneMissionStatusDto,
} from "./dto/drone-surveillance.dto";
import { DroneSurveillanceService } from "./drone-surveillance.service";

@ApiTags("drone-surveillance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("drone-surveillance")
export class DroneSurveillanceController {
  constructor(private readonly drones: DroneSurveillanceService) {}

  @Get("admin/dashboard")
  @RequirePermissions("drone:read")
  adminDashboard(@Req() request: any) {
    return this.drones.adminDashboard(request.user);
  }

  @Get("admin/fleet")
  @RequirePermissions("drone:read")
  adminListFleet(@Req() request: any) {
    return this.drones.adminListFleet(request.user);
  }

  @Get("admin/fleet/:id")
  @RequirePermissions("drone:read")
  adminGetFleetDevice(@Param("id") id: string, @Req() request: any) {
    return this.drones.adminGetFleetDevice(id, request.user);
  }

  @Post("admin/fleet")
  @RequirePermissions("drone:manage")
  adminCreateDevice(@Body() dto: CreateDroneDeviceDto, @Req() request: any) {
    return this.drones.adminCreateDevice(dto, request.user);
  }

  @Get("admin/missions")
  @RequirePermissions("drone:read")
  adminListMissions(@Query("status") status: string | undefined, @Req() request: any) {
    return this.drones.adminListMissions(status, request.user);
  }

  @Get("admin/missions/:id")
  @RequirePermissions("drone:read")
  adminGetMission(@Param("id") id: string, @Req() request: any) {
    return this.drones.adminGetMission(id, request.user);
  }

  @Post("admin/missions")
  @RequirePermissions("drone:mission:create")
  adminCreateMission(@Body() dto: CreateDroneMissionDto, @Req() request: any) {
    return this.drones.adminCreateMission(dto, request.user);
  }

  @Post("admin/missions/from-incident")
  @RequirePermissions("drone:mission:create")
  adminLaunchFromIncident(@Body() dto: LaunchMissionFromIncidentDto, @Req() request: any) {
    return this.drones.adminLaunchFromIncident(dto, request.user);
  }

  @Patch("admin/missions/:id/status")
  @RequirePermissions("drone:mission:command")
  adminUpdateMissionStatus(@Param("id") id: string, @Body() dto: UpdateDroneMissionStatusDto, @Req() request: any) {
    return this.drones.adminUpdateMissionStatus(id, dto, request.user);
  }

  @Get("admin/operators")
  @RequirePermissions("drone:read")
  adminListOperators(@Req() request: any) {
    return this.drones.adminListOperators(request.user);
  }

  @Post("admin/operators")
  @RequirePermissions("drone:manage")
  adminCreateOperator(@Body() dto: CreateDroneOperatorDto, @Req() request: any) {
    return this.drones.adminCreateOperator(dto, request.user);
  }

  @Get("admin/flight-history")
  @RequirePermissions("drone:read")
  adminFlightHistory(@Req() request: any) {
    return this.drones.adminFlightHistory(request.user);
  }

  @Get("admin/flight-logs")
  @RequirePermissions("drone:read")
  adminFlightLogs(@Req() request: any) {
    return this.drones.adminFlightLogs(request.user);
  }

  @Get("admin/evidence")
  @RequirePermissions("drone:evidence:read")
  adminListEvidence(@Req() request: any) {
    return this.drones.adminListEvidence(request.user);
  }

  @Post("admin/evidence/link")
  @RequirePermissions("drone:mission:command")
  adminLinkEvidence(@Body() dto: LinkDroneEvidenceDto, @Req() request: any) {
    return this.drones.adminLinkEvidence(dto, request.user);
  }

  @Get("admin/geofences")
  @RequirePermissions("drone:read")
  adminListGeofences(@Req() request: any) {
    return this.drones.adminListGeofences(request.user);
  }

  @Post("admin/geofences")
  @RequirePermissions("drone:manage")
  adminCreateGeofence(@Body() dto: CreateDroneGeofenceDto, @Req() request: any) {
    return this.drones.adminCreateGeofence(dto, request.user);
  }

  @Get("admin/no-fly-zones")
  @RequirePermissions("drone:read")
  adminListNoFlyZones(@Req() request: any) {
    return this.drones.adminListNoFlyZones(request.user);
  }

  @Post("admin/no-fly-zones")
  @RequirePermissions("drone:manage")
  adminCreateNoFlyZone(@Body() dto: CreateDroneNoFlyZoneDto, @Req() request: any) {
    return this.drones.adminCreateNoFlyZone(dto, request.user);
  }

  @Get("admin/health")
  @RequirePermissions("drone:read")
  adminHealthOverview(@Req() request: any) {
    return this.drones.adminHealthOverview(request.user);
  }

  @Get("admin/live-video")
  @RequirePermissions("drone:read")
  adminLiveVideoStatus(@Req() request: any) {
    return this.drones.adminLiveVideoStatus(request.user);
  }

  @Get("admin/live-gps")
  @RequirePermissions("drone:read")
  adminLiveGps(@Req() request: any) {
    return this.drones.adminLiveGps(request.user);
  }

  @Get("admin/incident-missions")
  @RequirePermissions("drone:read")
  adminIncidentMissions(@Req() request: any) {
    return this.drones.adminIncidentMissions(request.user);
  }
}
