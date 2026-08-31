import {
  Body,
  Controller,
  Get,
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
import { AgencyDirectoryService } from "./agency-directory.service";
import {
  CreateAgencyContactDto,
  CreateAgencyJurisdictionDto,
  CreateAgencyOfficeDto,
  UpdateAgencyContactDto,
  UpdateAgencyJurisdictionDto,
  UpdateAgencyOfficeDto,
  UpsertAgencyIncidentCapabilityDto,
} from "./dto/agency-directory-admin.dto";
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
  constructor(
    private readonly agencies: AgenciesService,
    private readonly directory: AgencyDirectoryService,
  ) {}

  @Get("admin/agencies/:id/directory")
  getDirectory(@Param("id", ParseUUIDPipe) id: string, @Req() request: { user: unknown }) {
    return this.directory.getAdminDirectory(request.user as never, id);
  }

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

  @Post("admin/agencies/:id/offices")
  createOffice(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateAgencyOfficeDto,
    @Req() request: { user: unknown },
  ) {
    return this.directory.createOffice(request.user as never, id, dto);
  }

  @Patch("admin/agency-offices/:officeId")
  updateOffice(
    @Param("officeId", ParseUUIDPipe) officeId: string,
    @Body() dto: UpdateAgencyOfficeDto,
    @Req() request: { user: unknown },
  ) {
    return this.directory.updateOffice(request.user as never, officeId, dto);
  }

  @Post("admin/agencies/:id/contacts")
  createContact(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateAgencyContactDto,
    @Req() request: { user: unknown },
  ) {
    return this.directory.createContact(request.user as never, id, dto);
  }

  @Patch("admin/agency-contacts/:contactId")
  updateContact(
    @Param("contactId", ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateAgencyContactDto,
    @Req() request: { user: unknown },
  ) {
    return this.directory.updateContact(request.user as never, contactId, dto);
  }

  @Post("admin/agencies/:id/jurisdictions")
  createJurisdiction(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateAgencyJurisdictionDto,
    @Req() request: { user: unknown },
  ) {
    return this.directory.createJurisdiction(request.user as never, id, dto);
  }

  @Patch("admin/agency-jurisdictions/:jurisdictionId")
  updateJurisdiction(
    @Param("jurisdictionId", ParseUUIDPipe) jurisdictionId: string,
    @Body() dto: UpdateAgencyJurisdictionDto,
    @Req() request: { user: unknown },
  ) {
    return this.directory.updateJurisdiction(request.user as never, jurisdictionId, dto);
  }

  @Post("admin/agencies/:id/incident-capabilities")
  upsertIncidentCapability(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpsertAgencyIncidentCapabilityDto,
    @Req() request: { user: unknown },
  ) {
    return this.directory.upsertIncidentCapability(request.user as never, id, dto);
  }
}
