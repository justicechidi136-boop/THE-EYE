import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { AdminRoleName } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { assertCanManageAgency, type AgencyScopeRow } from "./agency-scope";
import type {
  CreateAgencyContactDto,
  CreateAgencyJurisdictionDto,
  CreateAgencyOfficeDto,
  UpdateAgencyContactDto,
  UpdateAgencyJurisdictionDto,
  UpdateAgencyOfficeDto,
  UpsertAgencyIncidentCapabilityDto,
} from "./dto/agency-directory-admin.dto";
import type { AgencyDirectoryQueryDto, NearbyAgencyQueryDto } from "./dto/agency-directory.dto";

const publicContactSelect = {
  id: true,
  type: true,
  value: true,
  label: true,
  emergencyOnly: true,
} as const;

const radians = (degrees: number) => degrees * Math.PI / 180;
function distanceMeters(latA: number, lngA: number, latB: number, lngB: number) {
  const deltaLat = radians(latB - latA);
  const deltaLng = radians(lngB - lngA);
  const value = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(latA)) * Math.cos(radians(latB)) * Math.sin(deltaLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

@Injectable()
export class AgencyDirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  async list(query: AgencyDirectoryQueryDto) {
    const geography = await this.resolveGeography(query);
    const coverage = [
      { coverageType: "NATIONAL" as const },
      ...(geography.stateId ? [{ coverageType: "STATE" as const, stateId: geography.stateId }] : []),
      ...(geography.lgaId ? [{ coverageType: "LGA" as const, lgaId: geography.lgaId }] : []),
      ...(geography.wardId ? [{ coverageType: "WARD" as const, wardId: geography.wardId }] : []),
    ];
    const q = query.q?.trim();
    const agencies = await this.prisma.agency.findMany({
      where: {
        isActive: true,
        verificationStatus: { in: ["VERIFIED", "PARTIALLY_VERIFIED"] },
        ...(query.type ? { type: query.type } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { officialName: { contains: q, mode: "insensitive" } },
                { shortName: { contains: q, mode: "insensitive" } },
                { aliases: { has: q } },
              ],
            }
          : {}),
        ...(query.incidentType
          ? { incidentCapabilities: { some: { incidentType: query.incidentType as never, isActive: true } } }
          : {}),
        ...(query.stateId || query.lgaId || query.wardId
          ? { directoryJurisdictions: { some: { isActive: true, OR: coverage } } }
          : {}),
      },
      include: {
        directoryContacts: {
          where: { isActive: true, publiclyVerified: true, verificationStatus: "VERIFIED" },
          select: publicContactSelect,
        },
        incidentCapabilities: {
          where: { isActive: true },
          select: { incidentType: true, canReceiveReport: true },
        },
      },
      orderBy: [{ escalationPriority: "desc" }, { name: "asc" }],
      take: query.limit ?? 50,
    });
    return { data: agencies.map((agency) => this.toPublicAgency(agency)) };
  }

  async getById(id: string) {
    const agency = await this.prisma.agency.findFirst({
      where: {
        id,
        isActive: true,
        verificationStatus: { in: ["VERIFIED", "PARTIALLY_VERIFIED"] },
      },
      include: {
        directoryContacts: {
          where: { isActive: true, publiclyVerified: true, verificationStatus: "VERIFIED" },
          select: publicContactSelect,
        },
        offices: {
          where: { isActive: true, verificationStatus: { in: ["VERIFIED", "PARTIALLY_VERIFIED"] } },
          select: {
            id: true,
            name: true,
            officeType: true,
            physicalAddress: true,
            latitude: true,
            longitude: true,
            coordinatesVerified: true,
            is24Hours: true,
            state: { select: { name: true } },
            lga: { select: { name: true } },
            ward: { select: { name: true } },
            contacts: {
              where: { isActive: true, publiclyVerified: true, verificationStatus: "VERIFIED" },
              select: publicContactSelect,
            },
          },
        },
        incidentCapabilities: {
          where: { isActive: true },
          select: { incidentType: true, canReceiveReport: true },
        },
      },
    });
    if (!agency) throw new NotFoundException("Verified public agency not found");
    return { data: this.toPublicAgency(agency) };
  }

  async nearby(query: NearbyAgencyQueryDto) {
    const offices = await this.prisma.agencyOffice.findMany({
      where: {
        isActive: true,
        coordinatesVerified: true,
        latitude: { not: null },
        longitude: { not: null },
        verificationStatus: "VERIFIED",
        agency: {
          isActive: true,
          verificationStatus: { in: ["VERIFIED", "PARTIALLY_VERIFIED"] },
          ...(query.type ? { type: query.type } : {}),
        },
      },
      include: {
        agency: { select: { id: true, name: true, shortName: true, type: true } },
        contacts: {
          where: { isActive: true, publiclyVerified: true, verificationStatus: "VERIFIED" },
          select: publicContactSelect,
        },
      },
      take: 500,
    });
    const data = offices
      .map((office) => ({
        id: office.id,
        agency: office.agency,
        name: office.name,
        officeType: office.officeType,
        physicalAddress: office.physicalAddress,
        latitude: Number(office.latitude),
        longitude: Number(office.longitude),
        contacts: office.contacts,
        distanceMeters: Math.round(
          distanceMeters(query.lat, query.lng, Number(office.latitude), Number(office.longitude)),
        ),
      }))
      .filter((office) => office.distanceMeters <= (query.radiusMeters ?? 25000))
      .sort((left, right) => left.distanceMeters - right.distanceMeters);
    return { data };
  }

  async getAdminDirectory(actor: JwtPayload, agencyId: string) {
    const agency = await this.requireManagedAgency(actor, agencyId);
    const detail = await this.prisma.agency.findUnique({
      where: { id: agency.id },
      include: {
        offices: { orderBy: [{ name: "asc" }] },
        directoryContacts: { orderBy: [{ isActive: "desc" }, { type: "asc" }] },
        directoryJurisdictions: { orderBy: [{ priority: "desc" }] },
        incidentCapabilities: { orderBy: [{ priority: "desc" }] },
      },
    });
    return { data: detail };
  }

  async createOffice(actor: JwtPayload, agencyId: string, dto: CreateAgencyOfficeDto) {
    const agency = await this.requireManagedAgency(actor, agencyId);
    await this.requireCanonicalScope(dto.countryId, dto.stateId, dto.lgaId, dto.wardId);
    this.assertCoordinatePair(dto.latitude, dto.longitude, dto.coordinatesVerified);
    this.assertVerification(dto.verificationStatus, dto.sourceUrl);
    if (dto.parentOfficeId) await this.requireAgencyOffice(agency.id, dto.parentOfficeId);

    try {
      const office = await this.prisma.agencyOffice.create({
        data: {
          agencyId,
          parentOfficeId: dto.parentOfficeId,
          policeStationId: dto.policeStationId,
          countryId: dto.countryId,
          stateId: dto.stateId,
          lgaId: dto.lgaId,
          wardId: dto.wardId,
          name: dto.name.trim(),
          officeType: dto.officeType as never,
          physicalAddress: dto.physicalAddress?.trim(),
          latitude: dto.latitude,
          longitude: dto.longitude,
          coordinatesVerified: dto.coordinatesVerified ?? false,
          is24Hours: dto.is24Hours,
          verificationStatus: dto.verificationStatus as never,
          verifiedAt: dto.verificationStatus === "VERIFIED" ? new Date() : undefined,
          sourceUrl: dto.sourceUrl,
        },
      });
      await this.recordChange(actor, "agency.directory_office_created", "agency_offices", office.id, null, office);
      return { data: office };
    } catch (error) {
      this.throwDirectoryConflict(error, "Agency office already exists or references an invalid record");
    }
  }

  async updateOffice(actor: JwtPayload, officeId: string, dto: UpdateAgencyOfficeDto) {
    const current = await this.prisma.agencyOffice.findUnique({
      where: { id: officeId },
      include: { agency: true },
    });
    if (!current) throw new NotFoundException("Agency office not found");
    await this.assertManagedAgency(actor, current.agency);
    const latitude = dto.latitude === undefined ? current.latitude : dto.latitude;
    const longitude = dto.longitude === undefined ? current.longitude : dto.longitude;
    const coordinatesVerified = dto.coordinatesVerified ?? current.coordinatesVerified;
    this.assertCoordinatePair(latitude == null ? undefined : Number(latitude), longitude == null ? undefined : Number(longitude), coordinatesVerified);
    const verificationStatus = dto.verificationStatus ?? current.verificationStatus;
    const sourceUrl = dto.sourceUrl === undefined ? current.sourceUrl : dto.sourceUrl;
    this.assertVerification(verificationStatus, sourceUrl ?? undefined);

    const updated = await this.prisma.agencyOffice.update({
      where: { id: officeId },
      data: {
        name: dto.name?.trim(),
        officeType: dto.officeType as never,
        physicalAddress: dto.physicalAddress === undefined ? undefined : dto.physicalAddress?.trim() || null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        coordinatesVerified: dto.coordinatesVerified,
        is24Hours: dto.is24Hours,
        isActive: dto.isActive,
        verificationStatus: dto.verificationStatus as never,
        verifiedAt: dto.verificationStatus === "VERIFIED" ? new Date() : undefined,
        sourceUrl: dto.sourceUrl,
      },
    });
    await this.recordChange(actor, "agency.directory_office_updated", "agency_offices", officeId, current, updated);
    return { data: updated };
  }

  async createContact(actor: JwtPayload, agencyId: string, dto: CreateAgencyContactDto) {
    const agency = await this.requireManagedAgency(actor, agencyId);
    if (dto.officeId) await this.requireAgencyOffice(agency.id, dto.officeId);
    this.assertPublicContact(dto.publiclyVerified, dto.verificationStatus, dto.sourceUrl);
    try {
      const contact = await this.prisma.agencyContact.create({
        data: {
          agencyId,
          officeId: dto.officeId,
          type: dto.type as never,
          value: dto.value.trim(),
          label: dto.label?.trim(),
          emergencyOnly: dto.emergencyOnly ?? false,
          publiclyVerified: dto.publiclyVerified,
          verificationStatus: dto.verificationStatus as never,
          sourceUrl: dto.sourceUrl,
          lastVerifiedAt: dto.publiclyVerified ? new Date() : undefined,
        },
      });
      await this.recordChange(actor, "agency.directory_contact_created", "agency_contacts", contact.id, null, contact);
      return { data: contact };
    } catch (error) {
      this.throwDirectoryConflict(error, "Agency contact already exists or references an invalid record");
    }
  }

  async updateContact(actor: JwtPayload, contactId: string, dto: UpdateAgencyContactDto) {
    const current = await this.prisma.agencyContact.findUnique({
      where: { id: contactId },
      include: { agency: true },
    });
    if (!current) throw new NotFoundException("Agency contact not found");
    await this.assertManagedAgency(actor, current.agency);
    const publiclyVerified = dto.publiclyVerified ?? current.publiclyVerified;
    const verificationStatus = dto.verificationStatus ?? current.verificationStatus;
    const sourceUrl = dto.sourceUrl === undefined ? current.sourceUrl : dto.sourceUrl;
    this.assertPublicContact(publiclyVerified, verificationStatus, sourceUrl ?? undefined);
    const updated = await this.prisma.agencyContact.update({
      where: { id: contactId },
      data: {
        value: dto.value?.trim(),
        label: dto.label === undefined ? undefined : dto.label?.trim() || null,
        emergencyOnly: dto.emergencyOnly,
        publiclyVerified: dto.publiclyVerified,
        verificationStatus: dto.verificationStatus as never,
        sourceUrl: dto.sourceUrl,
        lastVerifiedAt: publiclyVerified ? new Date() : undefined,
        isActive: dto.isActive,
      },
    });
    await this.recordChange(actor, "agency.directory_contact_updated", "agency_contacts", contactId, current, updated);
    return { data: updated };
  }

  async createJurisdiction(actor: JwtPayload, agencyId: string, dto: CreateAgencyJurisdictionDto) {
    const agency = await this.requireManagedAgency(actor, agencyId);
    await this.requireCanonicalScope(dto.countryId, dto.stateId, dto.lgaId, dto.wardId);
    this.assertCoverageShape(dto);
    if (dto.officeId) await this.requireAgencyOffice(agency.id, dto.officeId);
    try {
      const jurisdiction = await this.prisma.agencyJurisdiction.create({
        data: {
          agencyId,
          officeId: dto.officeId,
          countryId: dto.countryId,
          stateId: dto.stateId,
          lgaId: dto.lgaId,
          wardId: dto.wardId,
          coverageType: dto.coverageType as never,
          customCoverage: dto.customCoverage as never,
          priority: dto.priority ?? 0,
          isPrimary: dto.isPrimary ?? false,
        },
      });
      await this.recordChange(actor, "agency.directory_jurisdiction_created", "agency_jurisdictions", jurisdiction.id, null, jurisdiction);
      return { data: jurisdiction };
    } catch (error) {
      this.throwDirectoryConflict(error, "Agency jurisdiction already exists or has an invalid hierarchy");
    }
  }

  async updateJurisdiction(actor: JwtPayload, jurisdictionId: string, dto: UpdateAgencyJurisdictionDto) {
    const current = await this.prisma.agencyJurisdiction.findUnique({
      where: { id: jurisdictionId },
      include: { agency: true },
    });
    if (!current) throw new NotFoundException("Agency jurisdiction not found");
    await this.assertManagedAgency(actor, current.agency);
    const updated = await this.prisma.agencyJurisdiction.update({
      where: { id: jurisdictionId },
      data: {
        priority: dto.priority,
        isPrimary: dto.isPrimary,
        isActive: dto.isActive,
        customCoverage: dto.customCoverage as never,
      },
    });
    await this.recordChange(actor, "agency.directory_jurisdiction_updated", "agency_jurisdictions", jurisdictionId, current, updated);
    return { data: updated };
  }

  async upsertIncidentCapability(actor: JwtPayload, agencyId: string, dto: UpsertAgencyIncidentCapabilityDto) {
    await this.requireManagedAgency(actor, agencyId);
    const existing = await this.prisma.agencyIncidentCapability.findUnique({
      where: { agencyId_incidentType: { agencyId, incidentType: dto.incidentType as never } },
    });
    const capability = await this.prisma.agencyIncidentCapability.upsert({
      where: { agencyId_incidentType: { agencyId, incidentType: dto.incidentType as never } },
      create: {
        agencyId,
        incidentType: dto.incidentType as never,
        priority: dto.priority ?? 0,
        canReceiveReport: dto.canReceiveReport ?? true,
        canDispatch: dto.canDispatch ?? false,
        canEscalate: dto.canEscalate ?? false,
        notes: dto.notes?.trim(),
        isActive: dto.isActive ?? true,
      },
      update: {
        priority: dto.priority,
        canReceiveReport: dto.canReceiveReport,
        canDispatch: dto.canDispatch,
        canEscalate: dto.canEscalate,
        notes: dto.notes?.trim(),
        isActive: dto.isActive,
      },
    });
    await this.recordChange(actor, "agency.incident_capability_upserted", "agency_incident_capabilities", capability.id, existing, capability);
    return { data: capability };
  }

  private async resolveGeography(query: AgencyDirectoryQueryDto) {
    if (query.wardId) {
      const ward = await this.prisma.ward.findFirst({
        where: { id: query.wardId, isActive: true },
        select: { id: true, lgaId: true, lga: { select: { stateId: true } } },
      });
      if (!ward) throw new NotFoundException("Ward not found");
      if (query.lgaId && query.lgaId !== ward.lgaId) throw new BadRequestException("Ward is not in the selected LGA");
      if (query.stateId && query.stateId !== ward.lga.stateId) throw new BadRequestException("Ward is not in the selected State");
      return { stateId: ward.lga.stateId, lgaId: ward.lgaId, wardId: ward.id };
    }
    if (query.lgaId) {
      const lga = await this.prisma.localGovernmentArea.findFirst({
        where: { id: query.lgaId, isActive: true },
        select: { id: true, stateId: true },
      });
      if (!lga) throw new NotFoundException("LGA/Area Council not found");
      if (query.stateId && query.stateId !== lga.stateId) throw new BadRequestException("LGA is not in the selected State");
      return { stateId: lga.stateId, lgaId: lga.id, wardId: undefined };
    }
    if (query.stateId) {
      const state = await this.prisma.administrativeState.findFirst({
        where: { id: query.stateId, isActive: true },
        select: { id: true },
      });
      if (!state) throw new NotFoundException("State/FCT not found");
    }
    return { stateId: query.stateId, lgaId: undefined, wardId: undefined };
  }

  private async requireManagedAgency(actor: JwtPayload, agencyId: string) {
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new NotFoundException("Agency not found");
    await this.assertManagedAgency(actor, agency);
    return agency;
  }

  private async assertManagedAgency(
    actor: JwtPayload,
    agency: AgencyScopeRow & { governmentLevel?: string | null },
  ) {
    assertCanManageAgency(actor, agency);
    if (agency.governmentLevel === "FEDERAL" && actor.role !== AdminRoleName.SuperAdmin) {
      throw new ForbiddenException("Only Super Admin may change a verified federal directory record");
    }
  }

  private async requireAgencyOffice(agencyId: string, officeId: string) {
    const office = await this.prisma.agencyOffice.findFirst({ where: { id: officeId, agencyId } });
    if (!office) throw new BadRequestException("Office does not belong to the selected agency");
    return office;
  }

  private async requireCanonicalScope(countryId: string, stateId?: string, lgaId?: string, wardId?: string) {
    if (wardId) {
      const ward = await this.prisma.ward.findFirst({
        where: { id: wardId, isActive: true },
        select: { lgaId: true, lga: { select: { stateId: true, state: { select: { countryId: true } } } } },
      });
      if (!ward || ward.lgaId !== lgaId || ward.lga.stateId !== stateId || ward.lga.state.countryId !== countryId) {
        throw new BadRequestException("Ward/LGA/State/Country hierarchy mismatch");
      }
      return;
    }
    if (lgaId) {
      const lga = await this.prisma.localGovernmentArea.findFirst({
        where: { id: lgaId, isActive: true },
        select: { stateId: true, state: { select: { countryId: true } } },
      });
      if (!lga || lga.stateId !== stateId || lga.state.countryId !== countryId) {
        throw new BadRequestException("LGA/State/Country hierarchy mismatch");
      }
      return;
    }
    if (stateId) {
      const state = await this.prisma.administrativeState.findFirst({
        where: { id: stateId, countryId, isActive: true },
      });
      if (!state) throw new BadRequestException("State/Country hierarchy mismatch");
      return;
    }
    const country = await this.prisma.country.findFirst({ where: { id: countryId, isActive: true } });
    if (!country) throw new BadRequestException("Country not found");
  }

  private assertCoordinatePair(latitude?: number, longitude?: number, verified = false) {
    if ((latitude == null) !== (longitude == null)) {
      throw new BadRequestException("Latitude and longitude must be supplied together");
    }
    if (verified && latitude == null) {
      throw new BadRequestException("Coordinates cannot be verified when no coordinates are stored");
    }
  }

  private assertVerification(status: string, sourceUrl?: string) {
    if ((status === "VERIFIED" || status === "PARTIALLY_VERIFIED") && !sourceUrl) {
      throw new BadRequestException("Verified records require an official source URL");
    }
  }

  private assertPublicContact(publiclyVerified: boolean, status: string, sourceUrl?: string) {
    if (publiclyVerified && (status !== "VERIFIED" || !sourceUrl)) {
      throw new BadRequestException("Public contacts must be verified and have official provenance");
    }
  }

  private assertCoverageShape(dto: CreateAgencyJurisdictionDto) {
    const valid =
      (dto.coverageType === "NATIONAL" && !dto.stateId && !dto.lgaId && !dto.wardId) ||
      (dto.coverageType === "STATE" && Boolean(dto.stateId) && !dto.lgaId && !dto.wardId) ||
      (dto.coverageType === "LGA" && Boolean(dto.stateId && dto.lgaId) && !dto.wardId) ||
      (dto.coverageType === "WARD" && Boolean(dto.stateId && dto.lgaId && dto.wardId)) ||
      (dto.coverageType === "CUSTOM_COVERAGE_AREA" && Boolean(dto.customCoverage));
    if (!valid) throw new BadRequestException("Coverage type does not match its canonical geography");
  }

  private async recordChange(
    actor: JwtPayload,
    action: string,
    entityType: string,
    entityId: string,
    beforeState: unknown,
    afterState: unknown,
  ) {
    await this.audit?.record({ actor, action, entityType, entityId, beforeState, afterState });
  }

  private throwDirectoryConflict(error: unknown, message: string): never {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = String((error as { code?: unknown }).code);
      if (code === "P2002" || code === "P2003") throw new ConflictException(message);
    }
    throw error;
  }

  private toPublicAgency(agency: Record<string, any>) {
    return {
      id: agency.id,
      code: agency.code,
      name: agency.officialName ?? agency.name,
      shortName: agency.shortName,
      aliases: agency.aliases,
      description: agency.description,
      type: agency.type,
      governmentLevel: agency.governmentLevel,
      officialWebsite: agency.officialWebsite,
      contacts: agency.directoryContacts,
      offices: agency.offices,
      incidentCapabilities: agency.incidentCapabilities,
    };
  }
}
