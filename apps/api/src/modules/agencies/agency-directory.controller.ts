import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AgencyDirectoryService } from "./agency-directory.service";
import { AgencyDirectoryQueryDto, NearbyAgencyQueryDto } from "./dto/agency-directory.dto";

@ApiTags("public-agencies")
@Controller("public/agencies")
export class AgencyDirectoryController {
  constructor(private readonly directory: AgencyDirectoryService) {}

  @Get()
  list(@Query() query: AgencyDirectoryQueryDto) {
    return this.directory.list(query);
  }

  @Get("nearby")
  nearby(@Query() query: NearbyAgencyQueryDto) {
    return this.directory.nearby(query);
  }

  @Get(":id")
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.directory.getById(id);
  }
}
