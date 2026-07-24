import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import {
  CheckPoliceDuplicatesDto,
  NearestPoliceStationsQuery,
  NearbyPoliceStationsQuery,
  PoliceStationListQuery,
  PoliceStationSearchQuery,
  UpsertPoliceStationDto,
  VerifyPoliceStationDto,
  validateCheckPoliceDuplicatesDto,
  validateVerifyPoliceStationDto,
} from "./dto/police-station.dto";
import { PoliceLocatorService } from "./police-locator.service";
import { PoliceStationsService } from "./police-stations.service";

@ApiTags("police-stations")
@Controller("police-stations")
export class PoliceStationsController {
  constructor(
    private readonly policeStations: PoliceStationsService,
    private readonly policeLocator: PoliceLocatorService,
  ) {}

  @Get()
  list(@Query() query: PoliceStationListQuery) {
    return this.policeStations.list(query);
  }

  @Get("nearby")
  @RateLimit("policeSearch")
  nearby(@Query() query: NearbyPoliceStationsQuery) {
    return this.policeLocator.nearby(query);
  }

  @Get("nearest")
  nearest(@Query() query: NearestPoliceStationsQuery) {
    return this.policeStations.nearest(query);
  }

  @Get("search")
  search(@Query() query: PoliceStationSearchQuery) {
    return this.policeStations.search(query);
  }

  @Post("check-duplicates")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("agency:manage")
  checkDuplicates(@Body() dto: CheckPoliceDuplicatesDto, @Req() request: any) {
    validateCheckPoliceDuplicatesDto(dto);
    return this.policeStations.checkDuplicates(dto, request.user);
  }

  @Get(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("agency:manage")
  getById(@Param("id") id: string, @Req() request: any) {
    return this.policeStations.getById(id, request.user);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("agency:manage")
  create(@Body() dto: UpsertPoliceStationDto, @Req() request: any) {
    return this.policeStations.create(dto, request.user);
  }

  @Patch(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("agency:manage")
  update(@Param("id") id: string, @Body() dto: UpsertPoliceStationDto, @Req() request: any) {
    return this.policeStations.update(id, dto, request.user);
  }

  @Patch(":id/verify")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("agency:manage")
  verify(@Param("id") id: string, @Body() dto: VerifyPoliceStationDto, @Req() request: any) {
    validateVerifyPoliceStationDto(dto);
    return this.policeLocator.verifyStation(id, dto, request.user);
  }
}
