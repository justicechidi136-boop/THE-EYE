import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  AGENCY_CAPABILITIES,
  AGENCY_ERROR_CODES,
  AgencyCapability,
  AgencyJurisdictionLevel,
  AgencyStatus,
  AgencyType,
  AgencyUnitKind,
  AdminRoleName,
  isOperationalRoleAllowedForAgencyType,
  normalizeAgencyType,
  type AgencySelector,
  type AgencyUnitSelector,
  validateAgencyCapabilities,
} from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  agencyListWhere,
  assertCanManageAgency,
  assertCanReadAgency,
  throwAgencyScope,
} from "./agency-scope";
import type {
  CreateAgencyDto,
  CreateAgencyUnitDto,
  ListAgenciesQueryDto,
  UpdateAgencyDto,
  UpdateAgencyUnitDto,
} from "./dto/agency.dto";

function parseBool(value?: string): boolean | undefined {
  if (value == null || value === "") return undefined;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new BadRequestException(`Invalid boolean query value: ${value}`);
}

@Injectable()
export class AgenciesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  async list(actor: JwtPayload, query: ListAgenciesQueryDto) {
    const scopeWhere = agencyListWhere(actor);
    const and: Record<string, unknown>[] = [scopeWhere];

    if (query.countryCode) and.push({ countryCode: query.countryCode });
    if (query.stateCode) and.push({ stateCode: query.stateCode });
    if (query.lgaCode) and.push({ lgaCode: query.lgaCode });
    if (query.agencyType) {
      const normalized = normalizeAgencyType(query.agencyType);
      if (!normalized) {
        throw new BadRequestException({
          code: AGENCY_ERROR_CODES.INVALID_TYPE,
          message: `Unknown agencyType: ${query.agencyType}`,
        });
      }
      and.push({ type: normalized });
    }
    if (query.capability) {
      if (!(AGENCY_CAPABILITIES as string[]).includes(query.capability)) {
        throw new BadRequestException({
          code: AGENCY_ERROR_CODES.INVALID_CAPABILITY,
          message: `Unknown capability: ${query.capability}`,
        });
      }
      and.push({ capabilities: { has: query.capability } });
    }
    const isDispatchable = parseBool(query.isDispatchable);
    if (isDispatchable !== undefined) and.push({ isDispatchable });
    const isFieldOperationsEnabled = parseBool(query.isFieldOperationsEnabled);
    if (isFieldOperationsEnabled !== undefined) and.push({ isFieldOperationsEnabled });
    const isActive = parseBool(query.isActive);
    if (isActive !== undefined) and.push({ isActive });
    if (query.search?.trim()) {
      const q = query.search.trim();
      and.push({
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
          { shortName: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    const rows = await this.prisma.agency.findMany({
      where: { AND: and },
      orderBy: [{ name: "asc" }],
      take: 500,
    });

    return { data: rows.map((row) => this.mapAgency(row)) };
  }

  async getById(actor: JwtPayload, id: string) {
    const agency = await this.requireAgency(id);
    assertCanReadAgency(actor, agency);
    return { data: this.mapAgency(agency) };
  }

  async listUnits(actor: JwtPayload, agencyId: string) {
    const agency = await this.requireAgency(agencyId);
    assertCanReadAgency(actor, agency);
    const units = await this.prisma.responseUnit.findMany({
      where: { agencyId, isActive: true },
      orderBy: [{ name: "asc" }, { unitIdentifier: "asc" }],
    });
    return { data: units.map((unit) => this.mapUnit(unit)) };
  }

  async listCapabilities(actor: JwtPayload, agencyId: string) {
    const agency = await this.requireAgency(agencyId);
    assertCanReadAgency(actor, agency);
    return {
      data: {
        agencyId: agency.id,
        capabilities: agency.capabilities,
        catalog: AGENCY_CAPABILITIES,
        flags: {
          isDispatchable: agency.isDispatchable,
          isFieldOperationsEnabled: agency.isFieldOperationsEnabled,
          isDroneEnabled: agency.isDroneEnabled,
          isBroadcastAuthority: agency.isBroadcastAuthority,
        },
      },
    };
  }

  async create(actor: JwtPayload, dto: CreateAgencyDto) {
    assertCanManageAgency(actor);

    const type = this.requireAgencyType(dto.type);
    this.assertCreateGeographyAllowed(actor, dto);
    if (actor.role === AdminRoleName.AgencyAdmin) {
      throwAgencyScope();
    }
    this.assertFederalMutation(actor, dto.governmentLevel);
    this.assertVerificationSource(dto.verificationStatus, dto.verificationSource);

    const capabilities = this.normalizeCapabilities(dto.capabilities ?? []);
    const flags = this.flagsFromCapabilities(dto, capabilities);

    if (dto.parentAgencyId) {
      const parent = await this.requireAgency(dto.parentAgencyId);
      assertCanReadAgency(actor, parent);
    }

    const code = dto.code.trim().toUpperCase();
    try {
      const created = await this.prisma.agency.create({
        data: {
          code,
          name: dto.name.trim(),
          officialName: dto.officialName?.trim() || null,
          description: dto.description?.trim() || null,
          aliases: dto.aliases ?? [],
          governmentLevel: dto.governmentLevel as never,
          officialWebsite: dto.officialWebsite?.trim() || null,
          verificationStatus: (dto.verificationStatus ?? "PENDING_VERIFICATION") as never,
          verifiedAt: dto.verificationStatus === "VERIFIED" ? new Date() : null,
          verificationSource: dto.verificationSource?.trim() || null,
          dataQualityNotes: dto.dataQualityNotes?.trim() || null,
          shortName: dto.shortName?.trim() || null,
          type,
          jurisdictionLevel: dto.jurisdictionLevel,
          countryCode: dto.countryCode.trim().toUpperCase(),
          stateCode: dto.stateCode?.trim().toUpperCase() || null,
          lgaCode: dto.lgaCode?.trim().toUpperCase() || null,
          jurisdictionId: dto.jurisdictionId ?? null,
          parentAgencyId: dto.parentAgencyId ?? null,
          serviceCategories: dto.serviceCategories ?? [],
          capabilities,
          isGovernment: dto.isGovernment ?? true,
          isEmergencyResponder: dto.isEmergencyResponder ?? true,
          isDispatchable: flags.isDispatchable,
          isFieldOperationsEnabled: flags.isFieldOperationsEnabled,
          isDroneEnabled: flags.isDroneEnabled,
          isBroadcastAuthority: flags.isBroadcastAuthority,
          phone: dto.phone?.trim() || null,
          email: dto.email?.trim() || null,
          contactMetadata: (dto.contactMetadata ?? {}) as never,
          status: AgencyStatus.Active,
          isActive: true,
        },
      });
      await this.audit?.record({
        actor,
        action: "agency.created",
        entityType: "agencies",
        entityId: created.id,
        afterState: created,
      });
      return { data: this.mapAgency(created) };
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException({
          code: AGENCY_ERROR_CODES.CODE_CONFLICT,
          message: `Agency code already exists: ${code}`,
        });
      }
      throw error;
    }
  }

  async update(actor: JwtPayload, id: string, dto: UpdateAgencyDto) {
    const agency = await this.requireAgency(id);
    assertCanManageAgency(actor, agency);
    this.assertFederalMutation(actor, dto.governmentLevel ?? agency.governmentLevel);
    this.assertVerificationSource(
      dto.verificationStatus ?? agency.verificationStatus,
      dto.verificationSource === undefined ? agency.verificationSource : dto.verificationSource,
    );

    const type = dto.type !== undefined ? this.requireAgencyType(dto.type) : undefined;
    const capabilities =
      dto.capabilities !== undefined ? this.normalizeCapabilities(dto.capabilities) : undefined;
    const flags =
      capabilities !== undefined
        ? this.flagsFromCapabilities(dto, capabilities)
        : {
            isDispatchable: dto.isDispatchable,
            isFieldOperationsEnabled: dto.isFieldOperationsEnabled,
            isDroneEnabled: dto.isDroneEnabled,
            isBroadcastAuthority: dto.isBroadcastAuthority,
          };

    if (dto.parentAgencyId) {
      if (dto.parentAgencyId === id) {
        throw new BadRequestException("Agency cannot be its own parent");
      }
      const parent = await this.requireAgency(dto.parentAgencyId);
      assertCanReadAgency(actor, parent);
    }

    const status = dto.status;
    const updated = await this.prisma.agency.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        officialName: dto.officialName === undefined ? undefined : dto.officialName?.trim() || null,
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
        aliases: dto.aliases,
        governmentLevel: dto.governmentLevel as never,
        officialWebsite: dto.officialWebsite === undefined ? undefined : dto.officialWebsite?.trim() || null,
        verificationStatus: dto.verificationStatus as never,
        verifiedAt: dto.verificationStatus === "VERIFIED" ? new Date() : undefined,
        verificationSource: dto.verificationSource === undefined ? undefined : dto.verificationSource?.trim() || null,
        dataQualityNotes: dto.dataQualityNotes === undefined ? undefined : dto.dataQualityNotes?.trim() || null,
        shortName: dto.shortName !== undefined ? dto.shortName?.trim() || null : undefined,
        type,
        jurisdictionLevel: dto.jurisdictionLevel,
        countryCode: dto.countryCode?.trim().toUpperCase(),
        stateCode:
          dto.stateCode !== undefined ? (dto.stateCode?.trim().toUpperCase() || null) : undefined,
        lgaCode: dto.lgaCode !== undefined ? (dto.lgaCode?.trim().toUpperCase() || null) : undefined,
        jurisdictionId: dto.jurisdictionId === undefined ? undefined : dto.jurisdictionId,
        parentAgencyId: dto.parentAgencyId === undefined ? undefined : dto.parentAgencyId,
        serviceCategories: dto.serviceCategories,
        capabilities,
        isGovernment: dto.isGovernment,
        isEmergencyResponder: dto.isEmergencyResponder,
        isDispatchable: flags.isDispatchable,
        isFieldOperationsEnabled: flags.isFieldOperationsEnabled,
        isDroneEnabled: flags.isDroneEnabled,
        isBroadcastAuthority: flags.isBroadcastAuthority,
        phone: dto.phone === undefined ? undefined : dto.phone?.trim() || null,
        email: dto.email === undefined ? undefined : dto.email?.trim() || null,
        contactMetadata: dto.contactMetadata as never | undefined,
        status,
        isActive: status === undefined ? undefined : status === AgencyStatus.Active,
      },
    });

    await this.audit?.record({
      actor,
      action: "agency.updated",
      entityType: "agencies",
      entityId: id,
      beforeState: agency,
      afterState: updated,
    });

    return { data: this.mapAgency(updated) };
  }

  async activate(actor: JwtPayload, id: string) {
    return this.update(actor, id, { status: AgencyStatus.Active });
  }

  async deactivate(actor: JwtPayload, id: string) {
    return this.update(actor, id, { status: AgencyStatus.Inactive });
  }

  async createUnit(actor: JwtPayload, agencyId: string, dto: CreateAgencyUnitDto) {
    const agency = await this.requireAgency(agencyId);
    assertCanManageAgency(actor, agency);

    if (dto.parentUnitId) {
      const parent = await this.prisma.responseUnit.findFirst({
        where: { id: dto.parentUnitId, agencyId },
      });
      if (!parent) {
        throw new BadRequestException({
          code: AGENCY_ERROR_CODES.UNIT_NOT_IN_AGENCY,
          message: "Parent unit does not belong to this agency",
        });
      }
    }

    try {
      const created = await this.prisma.responseUnit.create({
        data: {
          agencyId,
          unitIdentifier: dto.unitIdentifier.trim(),
          name: dto.name.trim(),
          unitKind: dto.unitKind ?? AgencyUnitKind.Other,
          parentUnitId: dto.parentUnitId ?? null,
          countryCode: dto.countryCode?.trim().toUpperCase() || agency.countryCode,
          stateCode: dto.stateCode?.trim().toUpperCase() || agency.stateCode,
          lgaCode: dto.lgaCode?.trim().toUpperCase() || agency.lgaCode,
          capabilities: dto.capabilities ?? [],
        },
      });
      return { data: this.mapUnit(created) };
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException("Unit identifier already exists for this agency");
      }
      throw error;
    }
  }

  async updateUnit(actor: JwtPayload, unitId: string, dto: UpdateAgencyUnitDto) {
    const unit = await this.prisma.responseUnit.findUnique({ where: { id: unitId } });
    if (!unit) {
      throw new NotFoundException({
        code: AGENCY_ERROR_CODES.UNIT_NOT_IN_AGENCY,
        message: "Unit not found",
      });
    }
    const agency = await this.requireAgency(unit.agencyId);
    assertCanManageAgency(actor, agency);

    if (dto.parentUnitId) {
      if (dto.parentUnitId === unitId) {
        throw new BadRequestException("Unit cannot be its own parent");
      }
      const parent = await this.prisma.responseUnit.findFirst({
        where: { id: dto.parentUnitId, agencyId: unit.agencyId },
      });
      if (!parent) {
        throw new BadRequestException({
          code: AGENCY_ERROR_CODES.UNIT_NOT_IN_AGENCY,
          message: "Parent unit does not belong to this agency",
        });
      }
    }

    const updated = await this.prisma.responseUnit.update({
      where: { id: unitId },
      data: {
        name: dto.name?.trim(),
        unitKind: dto.unitKind,
        parentUnitId: dto.parentUnitId === undefined ? undefined : dto.parentUnitId,
        countryCode:
          dto.countryCode !== undefined ? dto.countryCode?.trim().toUpperCase() || null : undefined,
        stateCode:
          dto.stateCode !== undefined ? dto.stateCode?.trim().toUpperCase() || null : undefined,
        lgaCode: dto.lgaCode !== undefined ? dto.lgaCode?.trim().toUpperCase() || null : undefined,
        capabilities: dto.capabilities,
        isActive: dto.isActive,
      },
    });
    return { data: this.mapUnit(updated) };
  }

  /** Used by Field Ops preprovision — validates agency + unit + role + profile compatibility. */
  async assertFieldOperationsAssignment(input: {
    actor: JwtPayload;
    agencyId: string;
    assignedUnitId?: string | null;
    operationalRole?: string | null;
    permissionProfileId?: string | null;
    compatibleAgencyTypes?: string[] | null;
  }) {
    const agency = await this.requireAgency(input.agencyId);
    assertCanReadAgency(input.actor, agency);

    if (!agency.isActive || agency.status !== AgencyStatus.Active) {
      throw new BadRequestException({
        code: AGENCY_ERROR_CODES.INACTIVE,
        message: "Agency is not active",
      });
    }
    if (!agency.isFieldOperationsEnabled) {
      throw new BadRequestException({
        code: AGENCY_ERROR_CODES.FIELD_OPS_DISABLED,
        message: "Agency is not enabled for field operations",
      });
    }

    const agencyType = this.requireAgencyType(agency.type);
    if (input.operationalRole) {
      if (!isOperationalRoleAllowedForAgencyType(agencyType, input.operationalRole)) {
        throw new BadRequestException({
          code: AGENCY_ERROR_CODES.ROLE_NOT_PERMITTED,
          message: `Operational role ${input.operationalRole} is not permitted for agency type ${agencyType}`,
        });
      }
    }

    const compatible = input.compatibleAgencyTypes ?? [];
    if (compatible.length > 0 && !compatible.includes(agencyType)) {
      throw new BadRequestException({
        code: AGENCY_ERROR_CODES.ROLE_NOT_PERMITTED,
        message: `Permission profile is not compatible with agency type ${agencyType}`,
      });
    }

    if (input.assignedUnitId) {
      const unit = await this.prisma.responseUnit.findFirst({
        where: { id: input.assignedUnitId, agencyId: agency.id, isActive: true },
      });
      if (!unit) {
        throw new BadRequestException({
          code: AGENCY_ERROR_CODES.UNIT_NOT_IN_AGENCY,
          message: "Assigned unit does not belong to the selected agency",
        });
      }
    }

    return agency;
  }

  private assertCreateGeographyAllowed(actor: JwtPayload, dto: CreateAgencyDto) {
    if (actor.role === AdminRoleName.SuperAdmin) return;

    if (actor.role === AdminRoleName.CountryAdmin) {
      if (dto.countryCode !== actor.country) throwAgencyScope();
      if (dto.jurisdictionLevel === AgencyJurisdictionLevel.Country && dto.countryCode !== actor.country) {
        throwAgencyScope();
      }
      return;
    }

    if (actor.role === AdminRoleName.StateAdmin) {
      if (dto.countryCode !== actor.country || dto.stateCode !== actor.state) throwAgencyScope();
      if (dto.jurisdictionLevel === AgencyJurisdictionLevel.Country) throwAgencyScope();
      return;
    }

    if (actor.role === AdminRoleName.LgaAdmin) {
      if (
        dto.countryCode !== actor.country ||
        dto.stateCode !== actor.state ||
        dto.lgaCode !== actor.lga
      ) {
        throwAgencyScope();
      }
      if (
        dto.jurisdictionLevel === AgencyJurisdictionLevel.Country ||
        dto.jurisdictionLevel === AgencyJurisdictionLevel.State
      ) {
        throwAgencyScope();
      }
      return;
    }
  }

  private requireAgencyType(value: string): AgencyType {
    const normalized = normalizeAgencyType(value);
    if (!normalized) {
      throw new BadRequestException({
        code: AGENCY_ERROR_CODES.INVALID_TYPE,
        message: `Unknown agency type: ${value}`,
      });
    }
    return normalized;
  }

  private normalizeCapabilities(values: string[]): AgencyCapability[] {
    const result = validateAgencyCapabilities(values);
    if (!result.valid) {
      throw new BadRequestException({
        code: AGENCY_ERROR_CODES.INVALID_CAPABILITY,
        message: `Unknown capabilities: ${result.unknown.join(", ")}`,
      });
    }
    return result.known;
  }

  private flagsFromCapabilities(
    dto: {
      isDispatchable?: boolean;
      isFieldOperationsEnabled?: boolean;
      isDroneEnabled?: boolean;
      isBroadcastAuthority?: boolean;
    },
    capabilities: AgencyCapability[],
  ) {
    const has = (cap: AgencyCapability) => capabilities.includes(cap);
    return {
      isDispatchable: dto.isDispatchable ?? has(AgencyCapability.IncidentDispatch),
      isFieldOperationsEnabled: dto.isFieldOperationsEnabled ?? has(AgencyCapability.FieldOperations),
      isDroneEnabled: dto.isDroneEnabled ?? has(AgencyCapability.DroneOperation),
      isBroadcastAuthority: dto.isBroadcastAuthority ?? has(AgencyCapability.BroadcastAuthority),
    };
  }

  private async requireAgency(id: string) {
    const agency = await this.prisma.agency.findUnique({ where: { id } });
    if (!agency) {
      throw new NotFoundException({
        code: AGENCY_ERROR_CODES.NOT_FOUND,
        message: "Agency not found",
      });
    }
    return agency;
  }

  private mapAgency(row: {
    id: string;
    code: string;
    name: string;
    shortName: string | null;
    type: string;
    jurisdictionLevel: string;
    countryCode: string;
    stateCode: string | null;
    lgaCode: string | null;
    capabilities: string[];
    isActive: boolean;
    status: string;
    isFieldOperationsEnabled: boolean;
    isDispatchable: boolean;
    isDroneEnabled: boolean;
    isBroadcastAuthority: boolean;
    isGovernment: boolean;
    isEmergencyResponder: boolean;
    parentAgencyId: string | null;
    jurisdictionId: string | null;
    phone: string | null;
    email: string | null;
    serviceCategories: string[];
  }): AgencySelector & Record<string, unknown> {
    const agencyType = (normalizeAgencyType(row.type) ?? AgencyType.Other) as AgencyType;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      shortName: row.shortName,
      agencyType,
      type: agencyType,
      jurisdictionLevel: row.jurisdictionLevel as AgencyJurisdictionLevel,
      countryCode: row.countryCode,
      stateCode: row.stateCode,
      lgaCode: row.lgaCode,
      capabilities: row.capabilities as AgencyCapability[],
      isActive: row.isActive,
      status: row.status,
      isFieldOperationsEnabled: row.isFieldOperationsEnabled,
      isDispatchable: row.isDispatchable,
      isDroneEnabled: row.isDroneEnabled,
      isBroadcastAuthority: row.isBroadcastAuthority,
      isGovernment: row.isGovernment,
      isEmergencyResponder: row.isEmergencyResponder,
      parentAgencyId: row.parentAgencyId,
      jurisdictionId: row.jurisdictionId,
      phone: row.phone,
      email: row.email,
      serviceCategories: row.serviceCategories,
    };
  }

  private mapUnit(row: {
    id: string;
    agencyId: string;
    name: string;
    unitIdentifier: string;
    unitKind: string;
    parentUnitId: string | null;
    countryCode: string | null;
    stateCode: string | null;
    lgaCode: string | null;
    isActive: boolean;
  }): AgencyUnitSelector {
    return {
      id: row.id,
      agencyId: row.agencyId,
      name: row.name || row.unitIdentifier,
      unitIdentifier: row.unitIdentifier,
      unitKind: (row.unitKind as AgencyUnitKind) || AgencyUnitKind.Other,
      parentUnitId: row.parentUnitId,
      countryCode: row.countryCode,
      stateCode: row.stateCode,
      lgaCode: row.lgaCode,
      isActive: row.isActive,
    };
  }

  private assertFederalMutation(actor: JwtPayload, governmentLevel?: string | null) {
    if (governmentLevel === "FEDERAL" && actor.role !== AdminRoleName.SuperAdmin) {
      throw new ForbiddenException("Only Super Admin may create or change a federal agency record");
    }
  }

  private assertVerificationSource(status?: string | null, source?: string | null) {
    if ((status === "VERIFIED" || status === "PARTIALLY_VERIFIED") && !source?.trim()) {
      throw new BadRequestException("Verified agency records require an official source URL");
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    );
  }
}
