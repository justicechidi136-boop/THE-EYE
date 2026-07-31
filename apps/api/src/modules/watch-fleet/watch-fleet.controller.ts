import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { WatchBulkService } from "./watch-bulk.service";
import { WatchFleetService, type OwnerSummaryQuery, type WatchInventoryQuery } from "./watch-fleet.service";
import { WatchOwnershipService, type AssignWatchDto, type TransferWatchDto } from "./watch-ownership.service";

@ApiTags("watch-fleet")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("watch-fleet")
export class WatchFleetController {
  constructor(
    private readonly fleet: WatchFleetService,
    private readonly ownership: WatchOwnershipService,
    private readonly bulk: WatchBulkService,
  ) {}

  @Get("owners")
  @RequirePermissions("user:manage")
  ownerSummaries(@Req() request: any, @Query() query: OwnerSummaryQuery) {
    return this.fleet.ownerSummaries(request.user, query);
  }

  @Get("owners/:ownerType/:ownerId")
  @RequirePermissions("user:manage")
  ownerDetail(@Req() request: any, @Param("ownerType") ownerType: string, @Param("ownerId") ownerId: string) {
    return this.fleet.ownerDetail(request.user, ownerType, ownerId);
  }

  @Get("inventory")
  @RequirePermissions("user:manage")
  watchInventory(@Req() request: any, @Query() query: WatchInventoryQuery) {
    return this.fleet.watchInventory(request.user, query);
  }

  @Get("inventory/unassigned")
  @RequirePermissions("user:manage")
  unassignedInventory(@Req() request: any, @Query() query: OwnerSummaryQuery) {
    return this.fleet.unassignedInventory(request.user, query);
  }

  @Get("organizations/:organizationId/inventory")
  @RequirePermissions("user:manage")
  organizationFleet(
    @Req() request: any,
    @Param("organizationId") organizationId: string,
    @Query() query: WatchInventoryQuery,
  ) {
    return this.fleet.organizationFleet(request.user, organizationId, query);
  }

  @Post("devices/register-inventory")
  @RequirePermissions("user:manage")
  registerInventory(
    @Req() request: any,
    @Body()
    body: {
      deviceId: string;
      serialNumber?: string;
      imei?: string;
      eid?: string;
      model?: string;
      manufacturer?: string;
      inventoryLocationId?: string;
      provider?: string;
    },
  ) {
    return this.ownership.registerInventoryDevice(request.user, body);
  }

  @Post("devices/assign")
  @RequirePermissions("user:manage")
  assignDevice(@Req() request: any, @Body() dto: AssignWatchDto) {
    return this.ownership.assignDevice(request.user, dto, request.ip);
  }

  @Post("devices/transfer")
  @RequirePermissions("user:manage")
  transferDevice(@Req() request: any, @Body() dto: TransferWatchDto) {
    return this.ownership.transferDevice(request.user, dto, request.ip);
  }

  @Post("devices/:deviceId/return-to-inventory")
  @RequirePermissions("user:manage")
  returnToInventory(
    @Req() request: any,
    @Param("deviceId") deviceId: string,
    @Body() body: { inventoryLocationId?: string; reason?: string; idempotencyKey?: string },
  ) {
    return this.ownership.returnToInventory(
      request.user,
      deviceId,
      body.inventoryLocationId,
      body.reason,
      body.idempotencyKey,
    );
  }

  @Post("devices/:deviceId/restore")
  @RequirePermissions("user:manage")
  restoreRecovered(@Req() request: any, @Param("deviceId") deviceId: string, @Body() body: { reason?: string }) {
    return this.ownership.restoreRecovered(request.user, deviceId, body.reason);
  }

  @Post("devices/:deviceId/lost-or-stolen")
  @RequirePermissions("user:manage")
  markLostOrStolen(@Req() request: any, @Param("deviceId") deviceId: string, @Body() body: { reason?: string }) {
    return this.ownership.markLostOrStolen(request.user, deviceId, body.reason);
  }

  @Post("devices/:deviceId/retire")
  @RequirePermissions("user:manage")
  retireDevice(@Req() request: any, @Param("deviceId") deviceId: string, @Body() body: { reason?: string }) {
    return this.ownership.retireDevice(request.user, deviceId, body.reason);
  }

  @Get("devices/:deviceId/ownership-history")
  @RequirePermissions("user:manage")
  ownershipHistory(@Req() request: any, @Param("deviceId") deviceId: string) {
    return this.ownership.ownershipHistory(deviceId, request.user);
  }

  @Get("devices/:deviceId/assignment-history")
  @RequirePermissions("user:manage")
  assignmentHistory(@Req() request: any, @Param("deviceId") deviceId: string) {
    return this.ownership.assignmentHistory(deviceId, request.user);
  }

  @Get("devices/:deviceId/transfer-history")
  @RequirePermissions("user:manage")
  transferHistory(@Req() request: any, @Param("deviceId") deviceId: string) {
    return this.ownership.transferHistory(deviceId, request.user);
  }

  @Post("bulk")
  @RequirePermissions("user:manage")
  enqueueBulk(
    @Req() request: any,
    @Body() body: { operationType: string; deviceIds: string[]; payload?: Record<string, unknown> },
  ) {
    return this.bulk.enqueueBulk(request.user, body.operationType, body.deviceIds, body.payload ?? {});
  }

  @Get("bulk/:jobId")
  @RequirePermissions("user:manage")
  getBulkJob(@Req() request: any, @Param("jobId") jobId: string) {
    return this.bulk.getBulkJob(jobId, request.user);
  }

  @Post("bulk/:jobId/cancel")
  @RequirePermissions("user:manage")
  cancelBulkJob(@Req() request: any, @Param("jobId") jobId: string) {
    return this.bulk.cancelBulkJob(jobId, request.user);
  }
}
