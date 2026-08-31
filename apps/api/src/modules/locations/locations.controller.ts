import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { LocationListQueryDto, LocationSearchQueryDto } from "./dto/location-query.dto";
import { LocationsService } from "./locations.service";

@ApiTags("locations")
@Controller("locations")
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get("countries/:countryCode/states")
  listStates(@Param("countryCode") countryCode: string, @Query() query: LocationListQueryDto) {
    return this.locations.listStates(countryCode, query);
  }

  @Get("states/:stateId/lgas")
  listLgas(@Param("stateId", ParseUUIDPipe) stateId: string, @Query() query: LocationListQueryDto) {
    return this.locations.listLgas(stateId, query);
  }

  @Get("lgas/:lgaId/wards")
  listWards(@Param("lgaId", ParseUUIDPipe) lgaId: string, @Query() query: LocationListQueryDto) {
    return this.locations.listWards(lgaId, query);
  }

  @Get("search")
  search(@Query() query: LocationSearchQueryDto) {
    return this.locations.search(query);
  }
}
