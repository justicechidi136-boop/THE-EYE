import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { NearestPoliceStationsQuery, PoliceStationSearchQuery, UpsertPoliceStationDto } from "./dto/police-station.dto";
import { PoliceStationsService } from "./police-stations.service";

@ApiTags("police-stations")
@Controller("police-stations")
export class PoliceStationsController {
  constructor(private readonly policeStations: PoliceStationsService) {}

  @Get("nearest")
  nearest(@Query() query: NearestPoliceStationsQuery) {
    return this.policeStations.nearest(query);
  }

  @Get("search")
  search(@Query() query: PoliceStationSearchQuery) {
    return this.policeStations.search(query);
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
}
