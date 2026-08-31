import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { AdminRoleName } from "@the-eye/shared";
import type { Prisma } from "@prisma/client";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { assertCanManageAgency, type AgencyScopeRow } from "./agency-scope";
import type {
  CreateAgencyContactDto,
  AgencyCoverageReportQueryDto,
  AgencyDataQualityQueueQueryDto,
  AgencyVerificationFreshnessQueryDto,
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
  verificationStatus: true,
} as const;

const coverageColumns = [
  "emergencyManagement",
  "fire",
  "ambulanceEms",
  "traffic",
  "policeCommand",
  "nscdcCommand",
  "frscCommand",
] as const;
type CoverageColumn = typeof coverageColumns[number];
type CoverageStatus = "VERIFIED" | "PARTIAL" | "NOT_VERIFIED" | "NOT_APPLICABLE" | "UNKNOWN";
type RoutingReadiness = "READY" | "NOT_READY";

const operationalContactTypes = new Set([
  "PHONE", "EMERGENCY_PHONE", "TOLL_FREE", "SMS", "WHATSAPP", "EMAIL", "REPORTING_PORTAL",
]);
const emergencyContactTypes = new Set(["EMERGENCY_PHONE", "TOLL_FREE"]);
const coordinateQualifiedEvidenceClasses = new Set([
  "AUTHORITATIVE_COORDINATE",
  "VERIFIED_ADDRESS_GEOCODE",
]);
const verificationFreshnessDays = 365;

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
            addressVerified: true,
            addressSourceUrl: true,
            addressVerifiedAt: true,
            latitude: true,
            longitude: true,
            coordinatesVerified: true,
            coordinateEvidenceClass: true,
            coordinatesSourceUrl: true,
            coordinatesVerifiedAt: true,
            verificationStatus: true,
            verifiedAt: true,
            is24Hours: true,
            operatingHoursVerified: true,
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
        coordinateEvidenceClass: { in: ["AUTHORITATIVE_COORDINATE", "VERIFIED_ADDRESS_GEOCODE"] },
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
    return {
      data,
      meta: {
        coordinateQualifiedCount: data.length,
        noLocationQualifiedResult: data.length === 0,
        distanceRankingUsesVerifiedCoordinatesOnly: true,
        centroidFallbackUsed: false,
      },
    };
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

  async getVerificationFreshnessReport(
    actor: JwtPayload,
    query: AgencyVerificationFreshnessQueryDto,
  ) {
    const states = await this.getScopedStates(actor, query.stateId);
    const stateIds = states.map((state) => state.id);
    const stateNames = states.map((state) => state.name);
    const staleDays = query.staleDays ?? 365;
    const staleBefore = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);
    const source = query.source?.trim();
    const agencyScope = this.agencyReportWhere(actor, stateIds, stateNames);
    const agencies = await this.prisma.agency.findMany({
      where: {
        AND: [
          agencyScope,
          query.agencyId ? { id: query.agencyId } : {},
        ],
      },
      include: {
        offices: {
          where: stateIds.length > 0 ? { OR: [{ stateId: null }, { stateId: { in: stateIds } }] } : undefined,
          select: {
            id: true,
            name: true,
            stateId: true,
            isActive: true,
            verificationStatus: true,
            verifiedAt: true,
            sourceUrl: true,
          },
        },
        directoryContacts: {
          select: {
            id: true,
            officeId: true,
            type: true,
            label: true,
            isActive: true,
            publiclyVerified: true,
            verificationStatus: true,
            sourceUrl: true,
            lastVerifiedAt: true,
          },
        },
      },
      orderBy: [{ name: "asc" }],
    });

    const findings: Array<Record<string, unknown>> = [];
    let totalFindings = 0;
    const limit = query.limit ?? 200;
    const add = (finding: Record<string, unknown>) => {
      totalFindings += 1;
      if (findings.length < limit) findings.push(finding);
    };
    const matchesStatus = (status: string) => !query.verificationStatus || status === query.verificationStatus;
    const matchesSource = (...values: Array<string | null | undefined>) => !source
      || values.some((value) => value?.toLowerCase().includes(source.toLowerCase()));
    for (const agency of agencies) {
      const agencyBase = {
        agencyId: agency.id,
        agencyCode: agency.code,
        agencyName: agency.name,
        verificationStatus: agency.verificationStatus,
      };
      if (matchesStatus(agency.verificationStatus) && matchesSource(agency.verificationSource, agency.officialWebsite)) {
        if (!agency.verificationSource) add({ ...agencyBase, recordType: "AGENCY", recordId: agency.id, issue: "MISSING_PROVENANCE" });
        if (agency.verificationStatus === "VERIFIED" && !agency.verifiedAt) {
          add({ ...agencyBase, recordType: "AGENCY", recordId: agency.id, issue: "VERIFIED_MISSING_DATE" });
        }
        if (agency.verificationStatus === "VERIFIED" && !agency.officialWebsite) {
          add({ ...agencyBase, recordType: "AGENCY", recordId: agency.id, issue: "MISSING_OFFICIAL_URL" });
        }
        if (agency.verificationStatus === "RETIRED" && agency.isActive) {
          add({ ...agencyBase, recordType: "AGENCY", recordId: agency.id, issue: "RETIRED_BUT_ACTIVE" });
        }
      }
      for (const office of agency.offices) {
        if (!matchesStatus(office.verificationStatus) || !matchesSource(office.sourceUrl)) continue;
        const officeBase = { ...agencyBase, verificationStatus: office.verificationStatus };
        if (!office.sourceUrl) add({ ...officeBase, recordType: "OFFICE", recordId: office.id, recordName: office.name, issue: "MISSING_PROVENANCE" });
        if (office.verificationStatus === "VERIFIED" && !office.verifiedAt) {
          add({ ...officeBase, recordType: "OFFICE", recordId: office.id, recordName: office.name, issue: "VERIFIED_MISSING_DATE" });
        }
        if (office.verificationStatus === "RETIRED" && office.isActive) {
          add({ ...officeBase, recordType: "OFFICE", recordId: office.id, recordName: office.name, issue: "RETIRED_BUT_ACTIVE" });
        }
      }
      for (const contact of agency.directoryContacts) {
        if (!matchesStatus(contact.verificationStatus) || !matchesSource(contact.sourceUrl)) continue;
        const contactBase = {
          ...agencyBase,
          recordType: "CONTACT",
          recordId: contact.id,
          contactType: contact.type,
          label: contact.label,
          verificationStatus: contact.verificationStatus,
        };
        if (!contact.sourceUrl) add({ ...contactBase, issue: "MISSING_PROVENANCE" });
        if (contact.verificationStatus === "VERIFIED" && !contact.lastVerifiedAt) {
          add({ ...contactBase, issue: "VERIFIED_MISSING_DATE" });
        } else if (contact.lastVerifiedAt && contact.lastVerifiedAt < staleBefore) {
          add({ ...contactBase, issue: "STALE_VERIFICATION", lastVerifiedAt: contact.lastVerifiedAt });
        }
        if (contact.verificationStatus === "RETIRED" && contact.isActive) {
          add({ ...contactBase, issue: "RETIRED_BUT_ACTIVE" });
        }
        if (contact.publiclyVerified && contact.isActive && contact.verificationStatus !== "VERIFIED") {
          add({ ...contactBase, issue: "PUBLIC_CONTACT_NOT_VERIFIED" });
        }
      }
    }

    return {
      data: findings,
      meta: {
        staleDays,
        staleBefore,
        agenciesReviewed: agencies.length,
        findings: totalFindings,
        returned: findings.length,
        truncated: totalFindings > findings.length,
      },
    };
  }

  async getCoverageReport(actor: JwtPayload, query: AgencyCoverageReportQueryDto) {
    const states = await this.getScopedStates(actor, query.stateId);
    const stateIds = states.map((state) => state.id);
    const stateNames = states.map((state) => state.name);
    const agencies = await this.prisma.agency.findMany({
      where: this.agencyReportWhere(actor, stateIds, stateNames),
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        governmentLevel: true,
        stateCode: true,
        isActive: true,
        verificationStatus: true,
        verifiedAt: true,
        directoryJurisdictions: {
          where: { stateId: { in: stateIds }, isActive: true },
          select: { stateId: true },
        },
        directoryContacts: {
          where: { isActive: true, publiclyVerified: true, verificationStatus: "VERIFIED" },
          select: {
            id: true,
            officeId: true,
            type: true,
            emergencyOnly: true,
            lastVerifiedAt: true,
          },
        },
        incidentCapabilities: {
          where: { isActive: true, canReceiveReport: true },
          select: { id: true },
        },
        offices: {
          where: {
            isActive: true,
            OR: [
              { stateId: { in: stateIds } },
              { jurisdictions: { some: { stateId: { in: stateIds }, isActive: true } } },
            ],
          },
          select: {
            id: true,
            stateId: true,
            name: true,
            isActive: true,
            physicalAddress: true,
            addressVerified: true,
            addressSourceUrl: true,
            addressVerifiedAt: true,
            latitude: true,
            longitude: true,
            coordinatesVerified: true,
            coordinateEvidenceClass: true,
            coordinatesSourceUrl: true,
            coordinatesVerifiedAt: true,
            is24Hours: true,
            operatingHoursVerified: true,
            operatingHoursSourceUrl: true,
            operatingHoursVerifiedAt: true,
            verificationStatus: true,
            verifiedAt: true,
            contacts: {
              where: { isActive: true, publiclyVerified: true, verificationStatus: "VERIFIED" },
              select: {
                id: true,
                officeId: true,
                type: true,
                emergencyOnly: true,
                lastVerifiedAt: true,
              },
            },
            jurisdictions: {
              where: { stateId: { in: stateIds }, isActive: true },
              select: { stateId: true },
            },
          },
        },
      },
      orderBy: [{ name: "asc" }],
    });

    const policeStations = await this.prisma.policeStation.findMany({
      where: {
        isActive: true,
        verificationStatus: { in: ["VerifiedOfficial", "VerifiedByAdmin"] },
        OR: [
          { jurisdiction: { stateRefId: { in: stateIds } } },
          { jurisdiction: { state: { in: stateNames } } },
        ],
      },
      select: {
        id: true,
        agency: { select: { code: true } },
        directoryOffice: { select: { id: true } },
        jurisdiction: { select: { stateRefId: true, state: true } },
      },
    });

    const data = states.map((state) => {
      const cells = Object.fromEntries(
        coverageColumns.map((column) => [column, this.coverageCell(column, state.id, state.name, agencies)]),
      );
      const pendingResearchCount = Object.values(cells).filter((cell) => cell.operationalStatus !== "VERIFIED").length;
      return {
        stateId: state.id,
        stateCode: state.code,
        state: state.name,
        stateType: state.type,
        policeOperationalEndpointCount: policeStations.filter((station) => (
          station.jurisdiction.stateRefId === state.id || station.jurisdiction.state === state.name
        )).length,
        policeStationsLinkedToNpfCount: policeStations.filter((station) => (
          (station.jurisdiction.stateRefId === state.id || station.jurisdiction.state === state.name)
          && station.agency?.code === "NG-NPF"
          && station.directoryOffice != null
        )).length,
        pendingResearchCount,
        sourceEvidenceCount: new Set(
          Object.values(cells).flatMap((cell) => cell.records.map((record) => record.id)),
        ).size,
        ...cells,
      };
    });
    return {
      data,
      meta: {
        states: data.length,
        semantics: "NOT_VERIFIED means THE EYE lacks authoritative verified data; it does not mean the service is absent.",
        definitions: {
          VERIFIED: "At least one appropriately verified directory record supports this category in the jurisdiction.",
          PARTIAL: "Relevant evidence exists, but the matching directory record is only partially verified.",
          NOT_VERIFIED: "THE EYE currently has no sufficiently verified directory record for this category; the service may still exist.",
          UNKNOWN: "A matching record exists, but available evidence is insufficient to classify it as verified or partial.",
          NOT_APPLICABLE: "The category is confirmed not to apply to the jurisdiction; absence alone never produces this status.",
          STRUCTURAL_COVERAGE: "A verified organization or formation and its jurisdiction are authoritatively supported. This does not imply a usable local endpoint.",
          CORE_FEDERAL_STRUCTURAL_COVERAGE: "Nationwide verified formation coverage only for the supported NPF, NSCDC, FRSC, and Federal Fire structural categories; it is not blanket verification of every category/State cell.",
          OPERATIONAL_DIRECTORY_COVERAGE: "Structural coverage plus a verified public address or actionable public contact for the matching State agency or federal formation.",
          ROUTING_READY: "Operational directory coverage, a current actionable contact, a current verification record, and an active report-receiving capability. This is directory readiness only and never authorizes dispatch or incident-data sharing.",
          COORDINATE_QUALIFIED: "Physical-distance ranking accepts only AUTHORITATIVE_COORDINATE or VERIFIED_ADDRESS_GEOCODE evidence. Third-party references, centroids, and unknown coordinates are excluded.",
        },
        coreFederalStructuralCoverage: "VERIFIED",
        structuralCategoryCoverageIsBlanketVerified: false,
        verificationFreshnessDays,
        automaticDispatchEnabled: false,
        automaticEscalationEnabled: false,
      },
    };
  }

  async getDataQualityQueue(actor: JwtPayload, query: AgencyDataQualityQueueQueryDto) {
    const states = await this.getScopedStates(actor, query.stateId);
    const stateIds = states.map((state) => state.id);
    const stateNames = states.map((state) => state.name);
    const staleDays = query.staleDays ?? verificationFreshnessDays;
    const staleBefore = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);
    const agencies = await this.prisma.agency.findMany({
      where: {
        AND: [
          this.agencyReportWhere(actor, stateIds, stateNames),
          query.agencyId ? { id: query.agencyId } : {},
          query.category ? { type: query.category } : {},
        ],
      },
      include: {
        offices: {
          where: {
            isActive: true,
            OR: [
              { stateId: { in: stateIds } },
              { jurisdictions: { some: { stateId: { in: stateIds }, isActive: true } } },
            ],
          },
          include: {
            state: { select: { id: true, name: true } },
            jurisdictions: { where: { isActive: true }, select: { stateId: true } },
            contacts: { where: { isActive: true } },
          },
        },
        directoryContacts: { where: { isActive: true } },
        incidentCapabilities: { where: { isActive: true, canReceiveReport: true } },
      },
      orderBy: [{ name: "asc" }],
    });

    const findings: Array<Record<string, unknown>> = [];
    const add = (finding: Record<string, unknown>) => {
      if (!query.missingField || finding.missingField === query.missingField) findings.push(finding);
    };
    const isVerifiedContact = (contact: Record<string, any>) => (
      contact.publiclyVerified && contact.verificationStatus === "VERIFIED" && Boolean(contact.sourceUrl)
    );
    for (const agency of agencies) {
      const agencyContacts = agency.directoryContacts.filter((contact) => contact.officeId == null);
      const endpoints = agency.offices.length > 0
        ? agency.offices.map((office) => ({ office, contacts: office.contacts }))
        : [{ office: null, contacts: agencyContacts }];
      for (const endpoint of endpoints) {
        const office = endpoint.office;
        const contacts = endpoint.contacts as Array<Record<string, any>>;
        const verifiedOperationalContacts = contacts.filter((contact) => (
          isVerifiedContact(contact) && operationalContactTypes.has(contact.type)
        ));
        const verifiedEmergencyContacts = contacts.filter((contact) => (
          isVerifiedContact(contact) && contact.emergencyOnly && emergencyContactTypes.has(contact.type)
        ));
        const state = office?.state?.name ?? agency.stateCode ?? null;
        const base = {
          agencyId: agency.id,
          agencyCode: agency.code,
          agencyName: agency.name,
          category: agency.type,
          officeId: office?.id ?? null,
          officeName: office?.name ?? null,
          state,
        };
        if (agency.verificationStatus === "VERIFIED" && verifiedOperationalContacts.length === 0) {
          add({ ...base, priority: 1, missingField: "MISSING_OPERATIONAL_CONTACT" });
        }
        const addressVerified = Boolean(
          office?.physicalAddress && office.addressVerified && office.addressSourceUrl && office.addressVerifiedAt,
        );
        if (office && office.verificationStatus === "VERIFIED" && !addressVerified) {
          add({ ...base, priority: 2, missingField: "MISSING_VERIFIED_ADDRESS" });
        }
        const coordinateQualified = Boolean(
          office?.coordinatesVerified
          && coordinateQualifiedEvidenceClasses.has(office.coordinateEvidenceClass)
          && office.coordinatesSourceUrl
          && office.coordinatesVerifiedAt
          && office.latitude != null
          && office.longitude != null,
        );
        if (addressVerified && !coordinateQualified) {
          add({ ...base, priority: 3, missingField: "MISSING_COORDINATES" });
        }
        if (agency.isEmergencyResponder && verifiedEmergencyContacts.length === 0) {
          add({ ...base, priority: 4, missingField: "MISSING_EMERGENCY_CONTACT" });
        }
        if (agency.incidentCapabilities.length > 0 && !addressVerified && verifiedOperationalContacts.length === 0) {
          add({ ...base, priority: 5, missingField: "NO_OPERATIONAL_ENDPOINT" });
        }
        const endpointVerifiedAt = office?.addressVerifiedAt
          ?? verifiedOperationalContacts.map((contact) => contact.lastVerifiedAt).filter(Boolean).sort().at(-1)
          ?? office?.verifiedAt
          ?? agency.verifiedAt;
        if (endpointVerifiedAt && endpointVerifiedAt < staleBefore) {
          add({
            ...base,
            priority: 6,
            missingField: "STALE_ENDPOINT",
            verificationAgeDays: Math.floor((Date.now() - endpointVerifiedAt.getTime()) / 86_400_000),
          });
        }
        const contactStates = new Map<string, Set<string>>();
        for (const contact of contacts) {
          const key = `${contact.type}:${contact.value}`;
          const statesForContact = contactStates.get(key) ?? new Set<string>();
          statesForContact.add(`${contact.verificationStatus}:${contact.publiclyVerified}`);
          contactStates.set(key, statesForContact);
        }
        if ([...contactStates.values()].some((statesForContact) => statesForContact.size > 1)) {
          add({ ...base, priority: 7, missingField: "CONFLICTING_CONTACT_EVIDENCE" });
        }
      }
    }
    findings.sort((left, right) => (
      Number(left.priority) - Number(right.priority)
      || String(left.state ?? "").localeCompare(String(right.state ?? ""))
      || String(left.agencyName).localeCompare(String(right.agencyName))
    ));
    const limit = query.limit ?? 200;
    return {
      data: findings.slice(0, limit),
      meta: {
        findings: findings.length,
        returned: Math.min(findings.length, limit),
        truncated: findings.length > limit,
        staleDays,
        semantics: "A finding means authoritative directory evidence is missing or stale; it does not mean the service does not exist.",
        automaticDispatchEnabled: false,
        automaticEscalationEnabled: false,
      },
    };
  }

  async createOffice(actor: JwtPayload, agencyId: string, dto: CreateAgencyOfficeDto) {
    const agency = await this.requireManagedAgency(actor, agencyId);
    await this.requireCanonicalScope(dto.countryId, dto.stateId, dto.lgaId, dto.wardId);
    this.assertCoordinatePair(dto.latitude, dto.longitude, dto.coordinatesVerified);
    this.assertOfficeEvidence(dto);
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
          addressVerified: dto.addressVerified ?? false,
          addressSourceUrl: dto.addressSourceUrl,
          addressVerifiedAt: dto.addressVerified ? new Date() : undefined,
          latitude: dto.latitude,
          longitude: dto.longitude,
          coordinatesVerified: dto.coordinatesVerified ?? false,
          coordinateEvidenceClass: (dto.coordinateEvidenceClass ?? "UNKNOWN") as never,
          coordinatesSourceUrl: dto.coordinatesSourceUrl,
          coordinatesVerifiedAt: dto.coordinatesVerified ? new Date() : undefined,
          is24Hours: dto.is24Hours,
          operatingHoursVerified: dto.operatingHoursVerified ?? false,
          operatingHoursSourceUrl: dto.operatingHoursSourceUrl,
          operatingHoursVerifiedAt: dto.operatingHoursVerified ? new Date() : undefined,
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
    this.assertOfficeEvidence({
      physicalAddress: dto.physicalAddress === undefined ? current.physicalAddress : dto.physicalAddress,
      addressVerified: dto.addressVerified ?? current.addressVerified,
      addressSourceUrl: dto.addressSourceUrl === undefined ? current.addressSourceUrl : dto.addressSourceUrl,
      latitude: latitude == null ? undefined : Number(latitude),
      longitude: longitude == null ? undefined : Number(longitude),
      coordinatesVerified,
      coordinateEvidenceClass: dto.coordinateEvidenceClass ?? current.coordinateEvidenceClass,
      coordinatesSourceUrl: dto.coordinatesSourceUrl === undefined ? current.coordinatesSourceUrl : dto.coordinatesSourceUrl,
      is24Hours: dto.is24Hours === undefined ? current.is24Hours : dto.is24Hours,
      operatingHoursVerified: dto.operatingHoursVerified ?? current.operatingHoursVerified,
      operatingHoursSourceUrl: dto.operatingHoursSourceUrl === undefined
        ? current.operatingHoursSourceUrl
        : dto.operatingHoursSourceUrl,
    });
    const verificationStatus = dto.verificationStatus ?? current.verificationStatus;
    const sourceUrl = dto.sourceUrl === undefined ? current.sourceUrl : dto.sourceUrl;
    this.assertVerification(verificationStatus, sourceUrl ?? undefined);

    const updated = await this.prisma.agencyOffice.update({
      where: { id: officeId },
      data: {
        name: dto.name?.trim(),
        officeType: dto.officeType as never,
        physicalAddress: dto.physicalAddress === undefined ? undefined : dto.physicalAddress?.trim() || null,
        addressVerified: dto.addressVerified,
        addressSourceUrl: dto.addressSourceUrl,
        addressVerifiedAt: dto.addressVerified === undefined ? undefined : dto.addressVerified ? new Date() : null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        coordinatesVerified: dto.coordinatesVerified,
        coordinateEvidenceClass: dto.coordinateEvidenceClass as never,
        coordinatesSourceUrl: dto.coordinatesSourceUrl,
        coordinatesVerifiedAt: dto.coordinatesVerified === undefined ? undefined : dto.coordinatesVerified ? new Date() : null,
        is24Hours: dto.is24Hours,
        operatingHoursVerified: dto.operatingHoursVerified,
        operatingHoursSourceUrl: dto.operatingHoursSourceUrl,
        operatingHoursVerifiedAt: dto.operatingHoursVerified === undefined
          ? undefined
          : dto.operatingHoursVerified ? new Date() : null,
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

  private async getScopedStates(actor: JwtPayload, requestedStateId?: string) {
    const where: Record<string, unknown> = {
      isActive: true,
      country: { code: "NG" },
      ...(requestedStateId ? { id: requestedStateId } : {}),
    };
    if (actor.role === AdminRoleName.CountryAdmin) {
      const country = actor.country?.trim().toLowerCase();
      if (country !== "ng" && country !== "nigeria") where.id = "__none__";
    } else if (actor.role !== AdminRoleName.SuperAdmin) {
      if (actor.state) {
        where.OR = [
          { name: { equals: actor.state, mode: "insensitive" } },
          { code: { equals: actor.state, mode: "insensitive" } },
          { officialName: { equals: actor.state, mode: "insensitive" } },
        ];
      } else if (actor.role === AdminRoleName.AgencyAdmin && actor.agencyId) {
        where.OR = [
          { agencyOffices: { some: { agencyId: actor.agencyId, isActive: true } } },
          { agencyJurisdictions: { some: { agencyId: actor.agencyId, isActive: true } } },
        ];
      } else {
        where.id = "__none__";
      }
    }
    return this.prisma.administrativeState.findMany({
      where,
      select: { id: true, code: true, name: true, type: true },
      orderBy: [{ name: "asc" }],
    });
  }

  private agencyReportWhere(
    actor: JwtPayload,
    stateIds: string[],
    stateNames: string[],
  ): Prisma.AgencyWhereInput {
    const geography: Prisma.AgencyWhereInput = {
      countryCode: "NG",
      OR: [
        { stateCode: { in: stateNames } },
        { offices: { some: { stateId: { in: stateIds }, isActive: true } } },
      ],
    };
    if (actor.role === AdminRoleName.AgencyAdmin) {
      return { countryCode: "NG", id: actor.agencyId ?? "__none__" };
    }
    if (actor.role === AdminRoleName.SuperAdmin || actor.role === AdminRoleName.CountryAdmin) {
      return {
        ...geography,
        OR: [...(geography.OR ?? []), { governmentLevel: "FEDERAL" }],
      };
    }
    return geography;
  }

  private coverageCell(
    column: CoverageColumn,
    stateId: string,
    stateName: string,
    agencies: Array<Record<string, any>>,
  ) {
    const stateTypeByColumn: Partial<Record<CoverageColumn, string[]>> = {
      emergencyManagement: ["STATE_EMERGENCY_AGENCY", "EMERGENCY_MANAGEMENT"],
      fire: ["FIRE_RESCUE"],
      ambulanceEms: ["EMS"],
      traffic: ["TRAFFIC_MANAGEMENT"],
    };
    const federalTypesByColumn: Partial<Record<CoverageColumn, string[]>> = {
      fire: ["FIRE_RESCUE"],
      policeCommand: ["POLICE"],
      nscdcCommand: ["CIVIL_DEFENCE"],
      frscCommand: ["ROAD_SAFETY"],
    };
    const stateMatches = stateTypeByColumn[column]
      ? agencies.filter((agency) => (
          agency.governmentLevel !== "FEDERAL"
          && agency.stateCode === stateName
          && stateTypeByColumn[column]?.includes(agency.type)
        )).flatMap((agency) => {
          const offices = agency.offices.filter((office: Record<string, any>) => (
            office.stateId === stateId
            || office.jurisdictions.some((jurisdiction: Record<string, any>) => jurisdiction.stateId === stateId)
          ));
          return offices.length > 0 ? offices.map((office: Record<string, any>) => ({ agency, office })) : [{ agency, office: null }];
        })
      : [];
    const federalMatches = agencies.flatMap((agency) => federalTypesByColumn[column]?.includes(agency.type)
      ? agency.offices.filter((office: Record<string, any>) => (
          office.stateId === stateId
          || office.jurisdictions.some((jurisdiction: Record<string, any>) => jurisdiction.stateId === stateId)
        )).map((office: Record<string, any>) => ({ agency, office }))
      : []);
    const matches = [...stateMatches, ...federalMatches];
    const status: CoverageStatus = matches.some(({ agency, office }) => (
      agency.verificationStatus === "VERIFIED" && (!office || office.verificationStatus === "VERIFIED")
    ))
      ? "VERIFIED"
      : matches.some(({ agency, office }) => (
          agency.verificationStatus === "PARTIALLY_VERIFIED"
          || office?.verificationStatus === "PARTIALLY_VERIFIED"
        ))
        ? "PARTIAL"
        : matches.length > 0
          ? "UNKNOWN"
          : "NOT_VERIFIED";
    const evidence = matches.map(({ agency, office }) => {
      const contacts = office
        ? [
            ...(agency.directoryContacts ?? []).filter((contact: Record<string, any>) => contact.officeId == null),
            ...(office.contacts ?? []),
          ]
        : (agency.directoryContacts ?? []);
      const organizationVerified = agency.verificationStatus === "VERIFIED";
      const formationVerified = !office || office.verificationStatus === "VERIFIED";
      const jurisdictionVerified = office
        ? office.jurisdictions.some((jurisdiction: Record<string, any>) => jurisdiction.stateId === stateId)
          || office.stateId === stateId
        : (agency.directoryJurisdictions ?? []).some((jurisdiction: Record<string, any>) => jurisdiction.stateId === stateId);
      const publicOfficeVerified = Boolean(office && office.verificationStatus === "VERIFIED");
      const publicAddressVerified = Boolean(
        publicOfficeVerified
        && office.physicalAddress?.trim()
        && office.addressVerified
        && office.addressSourceUrl
        && office.addressVerifiedAt,
      );
      const coordinatesVerified = Boolean(
        publicOfficeVerified
        && office.coordinatesVerified
        && coordinateQualifiedEvidenceClasses.has(office.coordinateEvidenceClass)
        && office.coordinatesSourceUrl
        && office.coordinatesVerifiedAt
        && office.latitude != null
        && office.longitude != null,
      );
      const publicContactVerified = contacts.length > 0;
      const operationalContactVerified = contacts.some((contact: Record<string, any>) => (
        operationalContactTypes.has(contact.type)
      ));
      const emergencyContactVerified = contacts.some((contact: Record<string, any>) => (
        contact.emergencyOnly && emergencyContactTypes.has(contact.type)
      ));
      const structuralVerified = organizationVerified && formationVerified && jurisdictionVerified;
      const operationalVerified = structuralVerified && (publicAddressVerified || operationalContactVerified);
      const freshAfter = Date.now() - verificationFreshnessDays * 24 * 60 * 60 * 1000;
      const isCurrent = (value: unknown) => value instanceof Date && value.getTime() >= freshAfter;
      const organizationCurrent = isCurrent(agency.verifiedAt);
      const formationCurrent = !office || isCurrent(office.verifiedAt);
      const endpointCurrent = (publicAddressVerified && isCurrent(office?.addressVerifiedAt))
        || contacts.some((contact: Record<string, any>) => (
          operationalContactTypes.has(contact.type) && isCurrent(contact.lastVerifiedAt)
        ));
      const verificationCurrent = organizationCurrent && formationCurrent && endpointCurrent;
      const locationReadiness = coordinatesVerified
        ? "DISTANCE_READY" as const
        : publicAddressVerified
          ? "ADDRESS_READY" as const
          : "NOT_READY" as const;
      const contactReadiness = operationalContactVerified ? "READY" as const : "NOT_READY" as const;
      const directoryReadiness = operationalVerified ? "READY" as const : "NOT_READY" as const;
      const routingReadiness: RoutingReadiness = directoryReadiness === "READY"
        && contactReadiness === "READY"
        && verificationCurrent
        && agency.isActive
        && (agency.incidentCapabilities ?? []).length > 0
        ? "READY"
        : "NOT_READY";
      return {
        id: office?.id ?? agency.id,
        code: agency.code,
        name: office?.name ?? agency.name,
        organizationVerified,
        formationVerified,
        jurisdictionVerified,
        publicOfficeVerified,
        publicAddressVerified,
        coordinatesVerified,
        publicContactVerified,
        operationalContactVerified,
        emergencyContactVerified,
        operatingHoursVerified: Boolean(office?.is24Hours != null && office.operatingHoursVerified),
        locationReadiness,
        contactReadiness,
        directoryReadiness,
        coordinateEvidenceClass: office?.coordinateEvidenceClass ?? "UNKNOWN",
        verifiedPublicContactCount: contacts.length,
        verifiedEmergencyContactCount: contacts.filter((contact: Record<string, any>) => (
          contact.emergencyOnly && emergencyContactTypes.has(contact.type)
        )).length,
        verificationCurrent,
        structuralStatus: structuralVerified ? "VERIFIED" as const : status,
        operationalStatus: operationalVerified ? "VERIFIED" as const : structuralVerified ? "PARTIAL" as const : status,
        routingReadiness,
      };
    });
    const operationalStatus: CoverageStatus = evidence.some((record) => record.operationalStatus === "VERIFIED")
      ? "VERIFIED"
      : status === "NOT_VERIFIED"
        ? "NOT_VERIFIED"
        : "PARTIAL";
    return {
      status,
      structuralStatus: status,
      operationalStatus,
      routingReadiness: evidence.some((record) => record.routingReadiness === "READY")
        ? "READY" as const
        : "NOT_READY" as const,
      evidence: {
        organizationOrFormationVerified: evidence.some((record) => record.organizationVerified && record.formationVerified),
        jurisdictionVerified: evidence.some((record) => record.jurisdictionVerified),
        publicOfficeVerified: evidence.some((record) => record.publicOfficeVerified),
        publicAddressVerified: evidence.some((record) => record.publicAddressVerified),
        coordinatesVerified: evidence.some((record) => record.coordinatesVerified),
        publicContactVerified: evidence.some((record) => record.publicContactVerified),
        emergencyContactVerified: evidence.some((record) => record.emergencyContactVerified),
        verifiedPublicContactCount: evidence.reduce((sum, record) => sum + record.verifiedPublicContactCount, 0),
        verifiedEmergencyContactCount: evidence.reduce((sum, record) => sum + record.verifiedEmergencyContactCount, 0),
        verifiedPublicOfficeCount: evidence.filter((record) => record.publicOfficeVerified).length,
        verifiedCoordinatesCount: evidence.filter((record) => record.coordinatesVerified).length,
      },
      records: evidence,
    };
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

  private assertOfficeEvidence(office: {
    physicalAddress?: string | null;
    addressVerified?: boolean;
    addressSourceUrl?: string | null;
    latitude?: number;
    longitude?: number;
    coordinatesVerified?: boolean;
    coordinateEvidenceClass?: string | null;
    coordinatesSourceUrl?: string | null;
    is24Hours?: boolean | null;
    operatingHoursVerified?: boolean;
    operatingHoursSourceUrl?: string | null;
  }) {
    if (office.addressVerified && (!office.physicalAddress?.trim() || !office.addressSourceUrl)) {
      throw new BadRequestException("Verified addresses require an address and official source URL");
    }
    const coordinateClass = office.coordinateEvidenceClass ?? "UNKNOWN";
    if (office.coordinatesVerified && !coordinateQualifiedEvidenceClasses.has(coordinateClass)) {
      throw new BadRequestException("Verified coordinates require authoritative or verified-address-geocode evidence");
    }
    if (office.coordinatesVerified && !office.coordinatesSourceUrl) {
      throw new BadRequestException("Verified coordinates require coordinate provenance");
    }
    if (coordinateClass === "THIRD_PARTY_REFERENCE" && office.coordinatesVerified) {
      throw new BadRequestException("Third-party coordinate references cannot be marked verified");
    }
    if (office.operatingHoursVerified && (office.is24Hours == null || !office.operatingHoursSourceUrl)) {
      throw new BadRequestException("Verified operating hours require a value and official source URL");
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
      verificationStatus: agency.verificationStatus,
      verifiedAt: agency.verifiedAt,
      officialWebsite: agency.officialWebsite,
      contacts: agency.directoryContacts,
      offices: agency.offices,
      incidentCapabilities: agency.incidentCapabilities,
    };
  }
}
