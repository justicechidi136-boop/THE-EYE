import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  AdminCreateMissingPersonDto,
  AdminCreateStolenVehicleDto,
  ListCaseQuery,
  UpdateMissingPersonCaseDto,
  UpdateStolenVehicleCaseDto,
} from "./dto/case-management.dto";
import { CaseManagementService } from "./case-management.service";

@ApiTags("case-management")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin")
export class CaseManagementController {
  constructor(private readonly caseManagement: CaseManagementService) {}

  @Get("missing-persons")
  @RequirePermissions("incident:read")
  listMissingPersons(@Req() request: any, @Query() query: ListCaseQuery) {
    return this.caseManagement.listMissingPersonCases(request.user, query);
  }

  @Post("missing-persons")
  @RequirePermissions("incident:create")
  createMissingPerson(@Body() dto: AdminCreateMissingPersonDto, @Req() request: any) {
    return this.caseManagement.createMissingPersonCase(dto, request.user);
  }

  @Get("missing-persons/:incidentId")
  @RequirePermissions("incident:read")
  getMissingPerson(@Param("incidentId") incidentId: string, @Req() request: any) {
    return this.caseManagement.getMissingPersonCase(incidentId, request.user);
  }

  @Patch("missing-persons/:incidentId")
  @RequirePermissions("incident:update")
  updateMissingPerson(@Param("incidentId") incidentId: string, @Body() dto: UpdateMissingPersonCaseDto, @Req() request: any) {
    return this.caseManagement.updateMissingPersonCase(incidentId, dto, request.user);
  }

  @Get("stolen-vehicles")
  @RequirePermissions("incident:read")
  listStolenVehicles(@Req() request: any, @Query() query: ListCaseQuery) {
    return this.caseManagement.listStolenVehicleCases(request.user, query);
  }

  @Post("stolen-vehicles")
  @RequirePermissions("incident:create")
  createStolenVehicle(@Body() dto: AdminCreateStolenVehicleDto, @Req() request: any) {
    return this.caseManagement.createStolenVehicleCase(dto, request.user);
  }

  @Get("stolen-vehicles/:incidentId")
  @RequirePermissions("incident:read")
  getStolenVehicle(@Param("incidentId") incidentId: string, @Req() request: any) {
    return this.caseManagement.getStolenVehicleCase(incidentId, request.user);
  }

  @Patch("stolen-vehicles/:incidentId")
  @RequirePermissions("incident:update")
  updateStolenVehicle(@Param("incidentId") incidentId: string, @Body() dto: UpdateStolenVehicleCaseDto, @Req() request: any) {
    return this.caseManagement.updateStolenVehicleCase(incidentId, dto, request.user);
  }
}
