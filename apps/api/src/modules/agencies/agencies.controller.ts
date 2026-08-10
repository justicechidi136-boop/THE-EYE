import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { AgenciesService } from "./agencies.service";
import { ListAgenciesQueryDto } from "./dto/agency.dto";

@ApiTags("agencies")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("agencies")
export class AgenciesController {
  constructor(private readonly agencies: AgenciesService) {}

  @Get()
  list(@Query() query: ListAgenciesQueryDto, @Req() request: { user: unknown }) {
    return this.agencies.list(request.user as never, query);
  }

  @Get(":id")
  getById(@Param("id", ParseUUIDPipe) id: string, @Req() request: { user: unknown }) {
    return this.agencies.getById(request.user as never, id);
  }

  @Get(":id/units")
  listUnits(@Param("id", ParseUUIDPipe) id: string, @Req() request: { user: unknown }) {
    return this.agencies.listUnits(request.user as never, id);
  }

  @Get(":id/capabilities")
  listCapabilities(@Param("id", ParseUUIDPipe) id: string, @Req() request: { user: unknown }) {
    return this.agencies.listCapabilities(request.user as never, id);
  }
}
