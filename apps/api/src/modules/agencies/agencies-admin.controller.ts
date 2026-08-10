import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { AgenciesService } from "./agencies.service";
import {
  CreateAgencyDto,
  CreateAgencyUnitDto,
  UpdateAgencyDto,
  UpdateAgencyUnitDto,
} from "./dto/agency.dto";

@ApiTags("admin-agencies")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("agency:manage")
@Controller()
export class AgenciesAdminController {
  constructor(private readonly agencies: AgenciesService) {}

  @Post("admin/agencies")
  create(@Body() dto: CreateAgencyDto, @Req() request: { user: unknown }) {
    return this.agencies.create(request.user as never, dto);
  }

  @Patch("admin/agencies/:id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgencyDto,
    @Req() request: { user: unknown },
  ) {
    return this.agencies.update(request.user as never, id, dto);
  }

  @Post("admin/agencies/:id/activate")
  activate(@Param("id", ParseUUIDPipe) id: string, @Req() request: { user: unknown }) {
    return this.agencies.activate(request.user as never, id);
  }

  @Post("admin/agencies/:id/deactivate")
  deactivate(@Param("id", ParseUUIDPipe) id: string, @Req() request: { user: unknown }) {
    return this.agencies.deactivate(request.user as never, id);
  }

  @Post("admin/agencies/:id/units")
  createUnit(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateAgencyUnitDto,
    @Req() request: { user: unknown },
  ) {
    return this.agencies.createUnit(request.user as never, id, dto);
  }

  @Patch("admin/agency-units/:unitId")
  updateUnit(
    @Param("unitId", ParseUUIDPipe) unitId: string,
    @Body() dto: UpdateAgencyUnitDto,
    @Req() request: { user: unknown },
  ) {
    return this.agencies.updateUnit(request.user as never, unitId, dto);
  }
}
