import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { FieldBackupRequestStatus } from "@the-eye/shared";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import type { CreateFieldBackupDto } from "./field-backup-requests.service";
import { FieldBackupRequestsService } from "./field-backup-requests.service";
import { FieldEventsService } from "./field-events.service";
import { FieldMapService } from "./field-map.service";
import type { OfficerSafetyDto } from "./field-officer-safety.service";
import { FieldOfficerSafetyService } from "./field-officer-safety.service";

@ApiTags("field-map")
@Controller("field/map")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldMapController {
  constructor(private readonly map: FieldMapService) {}

  @Get("context")
  @RequirePermissions("field:session:operate")
  context(
    @Req() request: { user: never },
    @Query("latitude") latitude?: string,
    @Query("longitude") longitude?: string,
    @Query("radiusMeters") radiusMeters?: string,
    @Query("layers") layers?: string,
  ) {
    return this.map.getMapContext(request.user, {
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      radiusMeters: radiusMeters ? Number(radiusMeters) : undefined,
      layers,
    });
  }
}

@ApiTags("field-events")
@Controller("field/events")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldEventsController {
  constructor(private readonly events: FieldEventsService) {}

  @Get()
  @RequirePermissions("field:session:operate")
  poll(
    @Req() request: { user: never },
    @Query("afterSequence") afterSequence?: string,
    @Query("generationId") generationId?: string,
    @Query("limit") limit?: string,
  ) {
    return this.events.poll(request.user, { afterSequence, generationId, limit });
  }
}

@ApiTags("field-safety")
@Controller("field/safety")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldSafetyController {
  constructor(private readonly safety: FieldOfficerSafetyService) {}

  @Post("panic")
  @RequirePermissions("field:session:operate")
  @RateLimit("sos")
  panic(@Req() request: { user: never }, @Body() dto: OfficerSafetyDto) {
    return this.safety.triggerPanic(request.user, dto);
  }

  @Post("officer-down")
  @RequirePermissions("field:session:operate")
  @RateLimit("sos")
  officerDown(@Req() request: { user: never }, @Body() dto: OfficerSafetyDto) {
    return this.safety.triggerOfficerDown(request.user, dto);
  }

  @Post("distress")
  @RequirePermissions("field:session:operate")
  @RateLimit("sos")
  distress(@Req() request: { user: never }, @Body() dto: OfficerSafetyDto) {
    return this.safety.triggerDistress(request.user, dto);
  }

  @Post("check-in/schedule")
  @RequirePermissions("field:session:operate")
  scheduleCheckIn(@Req() request: { user: never }, @Body() body: { dueInMinutes: number }) {
    return this.safety.scheduleCheckIn(request.user, body.dueInMinutes ?? 30);
  }
}

@ApiTags("field-backup")
@Controller("field/backup")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FieldBackupController {
  constructor(private readonly backup: FieldBackupRequestsService) {}

  @Post()
  @RequirePermissions("field:session:operate")
  @RateLimit("incidentCreate")
  create(@Req() request: { user: never }, @Body() dto: CreateFieldBackupDto) {
    return this.backup.create(request.user, dto);
  }

  @Get("mine")
  @RequirePermissions("field:session:operate")
  mine(@Req() request: { user: never }) {
    return this.backup.listMine(request.user);
  }

  @Patch(":id/status")
  @RequirePermissions("field:device:manage")
  updateStatus(@Param("id") id: string, @Req() request: { user: never }, @Body() body: { status: FieldBackupRequestStatus }) {
    return this.backup.updateStatus(id, request.user, body.status);
  }
}

