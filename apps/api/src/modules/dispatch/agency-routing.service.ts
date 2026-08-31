import { BadRequestException, Injectable } from "@nestjs/common";
import type { JwtPayload } from "../../common/auth/jwt";
import { adminCanAccessGeography } from "../../common/auth/admin-geography-scope";
import { throwAgencyScope } from "../agencies/agency-scope";
import { PrismaService } from "../prisma/prisma.service";
import { VERIFIED_POLICE_STATUSES } from "../police-stations/police-station.types";
import type { AgencyRecommendationPreviewDto } from "./dto/agency-recommendation.dto";

export const AGENCY_RECOMMENDATION_RULE_VERSION = "agency-recommendation-v1";

export type AdvisoryRecommendationTier = "PRIMARY" | "SECONDARY" | "STRUCTURAL_ONLY" | "INFORMATIONAL";

export type AdvisoryAgencyRecommendation = {
  agencyId: string;
  agencyName: string;
  officeId: string | null;
  officeName: string | null;
  endpointType: "AGENCY_OFFICE" | "POLICE_STATION" | "STRUCTURAL_AGENCY";
  tier: AdvisoryRecommendationTier;
  capability: string;
  jurisdictionLevel: "WARD" | "LGA" | "STATE" | "NATIONAL" | "CUSTOM_COVERAGE_AREA";
  verificationStatus: string;
  operationalReady: boolean;
  coordinateQualified: boolean;
  distanceMeters: number | null;
  publicAddress: string | null;
  publicContacts: Array<{ type: string; value: string; label: string | null; emergencyOnly: boolean }>;
  reasons: string[];
  limitations: string[];
  factors: {
    capabilityPriority: number;
    jurisdictionSpecificity: number;
    verificationCurrent: boolean;
    routingReadiness: "READY" | "NOT_READY";
  };
  provenance: {
    agencySource: string | null;
    officeSource: string | null;
    addressSource: string | null;
    coordinatesSource: string | null;
  };
};

type CanonicalPreviewGeography = {
  countryId: string;
  countryName: string;
  stateId: string | null;
  stateName: string | null;
  lgaId: string | null;
  lgaName: string | null;
  wardId: string | null;
  wardName: string | null;
};

const DIRECTORY_VERIFICATION_STATES = ["VERIFIED", "PARTIALLY_VERIFIED"];
const QUALIFIED_COORDINATE_CLASSES = new Set(["AUTHORITATIVE_COORDINATE", "VERIFIED_ADDRESS_GEOCODE"]);
const OPERATIONAL_CONTACT_TYPES = new Set([
  "PHONE", "EMERGENCY_PHONE", "TOLL_FREE", "SMS", "WHATSAPP", "EMAIL", "REPORTING_PORTAL",
]);
const VERIFICATION_FRESHNESS_MS = 365 * 24 * 60 * 60 * 1000;
const TIER_ORDER: Record<AdvisoryRecommendationTier, number> = {
  PRIMARY: 0,
  SECONDARY: 1,
  STRUCTURAL_ONLY: 2,
  INFORMATIONAL: 3,
};

export type AgencyRecommendation = {
  agencyId: string;
  name: string;
  type: string;
  serviceCategories: string[];
  distanceMeters: number | null;
  distanceSource: "postgis" | "haversine";
  availableResponders: number;
  availableUnits: number;
  activeAssignments: number;
  escalationPriority: number;
  score: number;
  rank: number;
};

export type RoutingInput = {
  jurisdictionId: string;
  latitude: number;
  longitude: number;
  suggestedAgencyTypes: string[];
  limit?: number;
};

@Injectable()
export class AgencyRoutingService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(input: AgencyRecommendationPreviewDto, actor: JwtPayload) {
    this.assertPreviewCoordinates(input.latitude, input.longitude);
    const geography = await this.resolveCanonicalGeography(input);
    if (!adminCanAccessGeography({
      country: geography.countryName,
      state: geography.stateName ?? undefined,
      lga: geography.lgaName ?? undefined,
    }, actor)) {
      throwAgencyScope();
    }

    const coverage = this.coverageFilters(geography);
    const agencies = await this.prisma.agency.findMany({
      where: {
        isActive: true,
        verificationStatus: { in: DIRECTORY_VERIFICATION_STATES },
        incidentCapabilities: {
          some: { incidentType: input.incidentType as never, isActive: true },
        },
        directoryJurisdictions: { some: { isActive: true, OR: coverage } },
      } as never,
      include: {
        incidentCapabilities: {
          where: { incidentType: input.incidentType as never, isActive: true },
          select: { incidentType: true, priority: true, canReceiveReport: true },
        },
        directoryJurisdictions: { where: { isActive: true, OR: coverage } as never },
        directoryContacts: {
          where: { officeId: null, isActive: true, publiclyVerified: true, verificationStatus: "VERIFIED" },
        },
        offices: {
          where: {
            isActive: true,
            verificationStatus: { in: DIRECTORY_VERIFICATION_STATES },
            OR: [
              { jurisdictions: { some: { isActive: true, OR: coverage } } },
              ...(geography.wardId ? [{ wardId: geography.wardId }] : []),
              ...(geography.lgaId ? [{ lgaId: geography.lgaId }] : []),
              ...(geography.stateId ? [{ stateId: geography.stateId }] : []),
            ],
          } as never,
          include: {
            jurisdictions: { where: { isActive: true, OR: coverage } as never },
            contacts: {
              where: { isActive: true, publiclyVerified: true, verificationStatus: "VERIFIED" },
            },
          },
        },
      },
      orderBy: [{ escalationPriority: "desc" }, { name: "asc" }],
      take: 100,
    });

    const candidates: AdvisoryAgencyRecommendation[] = [];
    for (const agency of agencies as Array<Record<string, any>>) {
      const capability = agency.incidentCapabilities[0];
      const officeCandidates = agency.offices
        .map((office: Record<string, any>) => this.buildOfficeRecommendation(
          agency,
          office,
          capability,
          geography,
          input.latitude,
          input.longitude,
        ));
      const operational = officeCandidates.filter((candidate: AdvisoryAgencyRecommendation) => candidate.operationalReady);
      candidates.push(...(operational.length > 0 ? officeCandidates : [
        this.buildStructuralRecommendation(agency, capability, geography),
      ]));
    }

    candidates.push(...await this.buildPoliceStationRecommendations(
      agencies as Array<Record<string, any>>,
      geography,
      input.latitude,
      input.longitude,
    ));

    const ordered = candidates
      .sort(compareAdvisoryRecommendations)
      .slice(0, input.limit ?? 20);
    const actionableRecommendations = ordered.filter((candidate) => (
      candidate.tier === "PRIMARY" || candidate.tier === "SECONDARY"
    ));
    const structuralMatches = ordered.filter((candidate) => candidate.tier === "STRUCTURAL_ONLY");
    const informationalMatches = ordered.filter((candidate) => candidate.tier === "INFORMATIONAL");

    return {
      ruleVersion: AGENCY_RECOMMENDATION_RULE_VERSION,
      generatedAt: new Date().toISOString(),
      advisoryOnly: true,
      externalActionTaken: false,
      input: {
        incidentType: input.incidentType,
        priority: input.priority ?? null,
        geography,
        hasVerifiedCoordinates: input.latitude != null,
      },
      actionableRecommendations,
      structuralMatches,
      informationalMatches,
      limitations: actionableRecommendations.length === 0
        ? ["No verified operational endpoint is currently available for this incident category in this jurisdiction."]
        : [],
      meta: {
        candidateIds: ordered.map((candidate) => `${candidate.agencyId}:${candidate.officeId ?? "structural"}`),
        distanceQualifiedCount: ordered.filter((candidate) => candidate.distanceMeters != null).length,
        incidentStateChanged: false,
        outboundCommunicationCalls: 0,
      },
    };
  }

  async recommend(input: RoutingInput): Promise<{ data: AgencyRecommendation[]; distanceSource: "postgis" | "haversine" }> {
    const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);
    const categories = input.suggestedAgencyTypes.length ? input.suggestedAgencyTypes : ["police"];

    try {
      const rows = await this.prisma.$queryRawUnsafe(
        `SELECT a.id,
                a.name,
                a.type,
                a.service_categories,
                a.escalation_priority,
                COALESCE(
                  ST_Distance(
                    a.agency_location,
                    ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
                  ),
                  NULL
                ) AS distance_meters,
                (
                  SELECT COUNT(*)::int
                    FROM responders r
                   WHERE r.agency_id = a.id
                     AND r.is_active = true
                     AND r.availability = 'Available'
                ) AS available_responders,
                (
                  SELECT COUNT(*)::int
                    FROM response_units ru
                   WHERE ru.agency_id = a.id
                     AND ru.is_active = true
                     AND ru.status = 'Available'
                ) AS available_units,
                (
                  SELECT COUNT(*)::int
                    FROM incident_assignments ia
                   WHERE ia.agency_id = a.id
                     AND ia.status IN ('Assigned', 'Accepted', 'Arrived')
                ) AS active_assignments
           FROM agencies a
          WHERE a.jurisdiction_id = $1::uuid
            AND a.is_active = true
            AND (
              cardinality(a.service_categories) = 0
              OR a.service_categories && $4::text[]
              OR a.type = ANY($4::text[])
            )
          ORDER BY a.escalation_priority DESC, distance_meters ASC NULLS LAST, a.name ASC
          LIMIT $5`,
        input.jurisdictionId,
        input.longitude,
        input.latitude,
        categories,
        limit * 3,
      ) as Array<Record<string, unknown>>;

      const ranked = this.rankRows(rows, input.latitude, input.longitude, limit);
      const distanceSource = ranked.some((row) => row.distanceSource === "postgis") ? "postgis" : "haversine";
      return { data: ranked, distanceSource };
    } catch {
      const agencies = await this.prisma.agency.findMany({
        where: {
          jurisdictionId: input.jurisdictionId,
          isActive: true,
        } as never,
        take: limit * 3,
      });

      const rows = agencies.map((agency) => ({
        id: agency.id,
        name: agency.name,
        type: agency.type,
        service_categories: (agency as any).serviceCategories ?? [],
        escalation_priority: (agency as any).escalationPriority ?? 0,
        latitude: (agency as any).latitude,
        longitude: (agency as any).longitude,
        distance_meters: (agency as any).latitude != null && (agency as any).longitude != null
          ? haversineMeters(
              input.latitude,
              input.longitude,
              Number((agency as any).latitude),
              Number((agency as any).longitude),
            )
          : null,
        available_responders: 0,
        available_units: 0,
        active_assignments: 0,
      }));

      return {
        data: this.rankRows(rows, input.latitude, input.longitude, limit, "haversine"),
        distanceSource: "haversine",
      };
    }
  }

  private buildOfficeRecommendation(
    agency: Record<string, any>,
    office: Record<string, any>,
    capability: Record<string, any>,
    geography: CanonicalPreviewGeography,
    latitude?: number,
    longitude?: number,
  ): AdvisoryAgencyRecommendation {
    const jurisdictions = office.jurisdictions.length > 0
      ? office.jurisdictions
      : agency.directoryJurisdictions;
    const jurisdiction = this.bestJurisdiction(jurisdictions, geography);
    const contacts = [...agency.directoryContacts, ...office.contacts];
    const publicContacts = contacts.map((contact: Record<string, any>) => ({
      type: String(contact.type),
      value: String(contact.value),
      label: contact.label ? String(contact.label) : null,
      emergencyOnly: Boolean(contact.emergencyOnly),
    }));
    const operationalContact = contacts.some((contact: Record<string, any>) => OPERATIONAL_CONTACT_TYPES.has(contact.type));
    const addressVerified = Boolean(
      office.physicalAddress?.trim()
      && office.addressVerified
      && office.addressSourceUrl
      && office.addressVerifiedAt,
    );
    const coordinateQualified = Boolean(
      office.coordinatesVerified
      && QUALIFIED_COORDINATE_CLASSES.has(office.coordinateEvidenceClass)
      && office.coordinatesSourceUrl
      && office.coordinatesVerifiedAt
      && office.latitude != null
      && office.longitude != null,
    );
    const verificationCurrent = this.isCurrent(agency.verifiedAt)
      && this.isCurrent(office.verifiedAt)
      && (
        (addressVerified && this.isCurrent(office.addressVerifiedAt))
        || contacts.some((contact: Record<string, any>) => this.isCurrent(contact.lastVerifiedAt))
      );
    const operationalReady = agency.verificationStatus === "VERIFIED"
      && office.verificationStatus === "VERIFIED"
      && capability.canReceiveReport
      && operationalContact
      && verificationCurrent;
    const distance = latitude != null && longitude != null && coordinateQualified
      ? Math.round(haversineMeters(latitude, longitude, Number(office.latitude), Number(office.longitude)))
      : null;
    const tier: AdvisoryRecommendationTier = operationalReady
      ? jurisdiction.specificity >= 2 ? "PRIMARY" : "SECONDARY"
      : agency.verificationStatus === "VERIFIED" && office.verificationStatus === "VERIFIED"
        ? "STRUCTURAL_ONLY"
        : "INFORMATIONAL";
    const limitations = [
      ...(!operationalContact ? ["No verified operational contact"] : []),
      ...(!addressVerified ? ["No verified public address"] : []),
      ...(!coordinateQualified ? ["No verified coordinates"] : []),
      ...(!verificationCurrent ? ["Operational evidence is stale or incomplete"] : []),
      ...(agency.verificationStatus !== "VERIFIED" || office.verificationStatus !== "VERIFIED"
        ? ["Partially verified directory record"]
        : []),
    ];
    return {
      agencyId: agency.id,
      agencyName: agency.name,
      officeId: office.id,
      officeName: office.name,
      endpointType: "AGENCY_OFFICE",
      tier,
      capability: capability.incidentType,
      jurisdictionLevel: jurisdiction.level,
      verificationStatus: office.verificationStatus,
      operationalReady,
      coordinateQualified,
      distanceMeters: distance,
      publicAddress: addressVerified ? office.physicalAddress : null,
      publicContacts,
      reasons: [
        `${agency.verificationStatus === "VERIFIED" ? "Verified" : "Partially verified"} ${String(capability.incidentType).toLowerCase()} capability for ${this.geographyLabel(geography)} jurisdiction.`,
        `${jurisdiction.level} jurisdiction match.`,
      ],
      limitations,
      factors: {
        capabilityPriority: Number(capability.priority ?? 0),
        jurisdictionSpecificity: jurisdiction.specificity,
        verificationCurrent,
        routingReadiness: operationalReady ? "READY" : "NOT_READY",
      },
      provenance: {
        agencySource: agency.verificationSource ?? null,
        officeSource: office.sourceUrl ?? null,
        addressSource: addressVerified ? office.addressSourceUrl : null,
        coordinatesSource: coordinateQualified ? office.coordinatesSourceUrl : null,
      },
    };
  }

  private buildStructuralRecommendation(
    agency: Record<string, any>,
    capability: Record<string, any>,
    geography: CanonicalPreviewGeography,
  ): AdvisoryAgencyRecommendation {
    const jurisdiction = this.bestJurisdiction(agency.directoryJurisdictions, geography);
    const current = this.isCurrent(agency.verifiedAt);
    return {
      agencyId: agency.id,
      agencyName: agency.name,
      officeId: null,
      officeName: null,
      endpointType: "STRUCTURAL_AGENCY",
      tier: agency.verificationStatus === "VERIFIED" ? "STRUCTURAL_ONLY" : "INFORMATIONAL",
      capability: capability.incidentType,
      jurisdictionLevel: jurisdiction.level,
      verificationStatus: agency.verificationStatus,
      operationalReady: false,
      coordinateQualified: false,
      distanceMeters: null,
      publicAddress: null,
      publicContacts: [],
      reasons: [
        `${agency.verificationStatus === "VERIFIED" ? "Verified" : "Partially verified"} ${String(capability.incidentType).toLowerCase()} capability for ${this.geographyLabel(geography)} jurisdiction.`,
        `${jurisdiction.level} structural jurisdiction match.`,
      ],
      limitations: [
        "Structural jurisdiction only",
        "No verified operational endpoint",
        "No verified coordinates",
        ...(!current ? ["Verification is stale"] : []),
      ],
      factors: {
        capabilityPriority: Number(capability.priority ?? 0),
        jurisdictionSpecificity: jurisdiction.specificity,
        verificationCurrent: current,
        routingReadiness: "NOT_READY",
      },
      provenance: {
        agencySource: agency.verificationSource ?? null,
        officeSource: null,
        addressSource: null,
        coordinatesSource: null,
      },
    };
  }

  private async buildPoliceStationRecommendations(
    agencies: Array<Record<string, any>>,
    geography: CanonicalPreviewGeography,
    latitude?: number,
    longitude?: number,
  ): Promise<AdvisoryAgencyRecommendation[]> {
    const policeAgencies = agencies.filter((agency) => agency.code === "NG-NPF");
    if (policeAgencies.length === 0 || !geography.stateName) return [];
    const stations = await this.prisma.policeStation.findMany({
      where: {
        agencyId: { in: policeAgencies.map((agency) => agency.id) },
        isActive: true,
        verificationStatus: { in: VERIFIED_POLICE_STATUSES },
        OR: [
          { state: geography.stateName },
          { jurisdiction: { state: geography.stateName } },
        ],
      } as never,
      include: { jurisdiction: true },
      orderBy: [{ name: "asc" }],
      take: 100,
    });
    return (stations as Array<Record<string, any>>)
      .filter((station) => !geography.lgaName
        || station.lga === geography.lgaName
        || station.jurisdiction?.lga === geography.lgaName)
      .map((station) => {
        const agency = policeAgencies.find((candidate) => candidate.id === station.agencyId)!;
        const capability = agency.incidentCapabilities[0];
        const contact = station.emergencyPhone ?? station.officialPhone ?? station.phone ?? null;
        const coordinatesQualified = station.latitude != null && station.longitude != null;
        const current = this.isCurrent(station.verifiedAt ?? station.lastReviewedAt);
        const operationalReady = Boolean(contact && coordinatesQualified && current);
        const specificity = geography.lgaName
          && (station.lga === geography.lgaName || station.jurisdiction?.lga === geography.lgaName)
          ? 3
          : 2;
        return {
          agencyId: agency.id,
          agencyName: agency.name,
          officeId: station.id,
          officeName: station.name,
          endpointType: "POLICE_STATION" as const,
          tier: operationalReady ? "PRIMARY" as const : "INFORMATIONAL" as const,
          capability: capability.incidentType,
          jurisdictionLevel: specificity === 3 ? "LGA" as const : "STATE" as const,
          verificationStatus: station.verificationStatus,
          operationalReady,
          coordinateQualified: coordinatesQualified,
          distanceMeters: latitude != null && longitude != null && coordinatesQualified
            ? Math.round(haversineMeters(latitude, longitude, Number(station.latitude), Number(station.longitude)))
            : null,
          publicAddress: station.address ?? null,
          publicContacts: contact ? [{
            type: station.emergencyPhone ? "EMERGENCY_PHONE" : "PHONE",
            value: String(contact),
            label: null,
            emergencyOnly: Boolean(station.emergencyPhone),
          }] : [],
          reasons: [
            `Verified PoliceStation endpoint for ${this.geographyLabel(geography)} jurisdiction.`,
            `${specificity === 3 ? "LGA" : "STATE"} operational-location match.`,
          ],
          limitations: [
            ...(!contact ? ["No verified operational contact"] : []),
            ...(!coordinatesQualified ? ["No verified coordinates"] : []),
            ...(!current ? ["Verification is stale"] : []),
          ],
          factors: {
            capabilityPriority: Number(capability.priority ?? 0),
            jurisdictionSpecificity: specificity,
            verificationCurrent: current,
            routingReadiness: operationalReady ? "READY" as const : "NOT_READY" as const,
          },
          provenance: {
            agencySource: agency.verificationSource ?? null,
            officeSource: station.sourceReference ?? station.source ?? null,
            addressSource: station.sourceReference ?? station.source ?? null,
            coordinatesSource: station.sourceReference ?? station.source ?? null,
          },
        } satisfies AdvisoryAgencyRecommendation;
      });
  }

  private bestJurisdiction(jurisdictions: Array<Record<string, any>>, geography: CanonicalPreviewGeography) {
    const matches = jurisdictions.map((jurisdiction) => ({
      level: String(jurisdiction.coverageType) as AdvisoryAgencyRecommendation["jurisdictionLevel"],
      specificity: jurisdiction.coverageType === "WARD" && jurisdiction.wardId === geography.wardId
        ? 4
        : jurisdiction.coverageType === "LGA" && jurisdiction.lgaId === geography.lgaId
          ? 3
          : jurisdiction.coverageType === "STATE" && jurisdiction.stateId === geography.stateId
            ? 2
            : jurisdiction.coverageType === "NATIONAL" && jurisdiction.countryId === geography.countryId
              ? 1
              : jurisdiction.coverageType === "CUSTOM_COVERAGE_AREA"
                ? 1
                : 0,
    })).filter((match) => match.specificity > 0);
    return matches.sort((left, right) => right.specificity - left.specificity)[0]
      ?? { level: "NATIONAL" as const, specificity: 1 };
  }

  private coverageFilters(geography: CanonicalPreviewGeography) {
    return [
      { coverageType: "NATIONAL", countryId: geography.countryId },
      ...(geography.stateId ? [{ coverageType: "STATE", countryId: geography.countryId, stateId: geography.stateId }] : []),
      ...(geography.lgaId ? [{ coverageType: "LGA", countryId: geography.countryId, lgaId: geography.lgaId }] : []),
      ...(geography.wardId ? [{ coverageType: "WARD", countryId: geography.countryId, wardId: geography.wardId }] : []),
      {
        coverageType: "CUSTOM_COVERAGE_AREA",
        countryId: geography.countryId,
        ...(geography.stateId ? { stateId: geography.stateId } : {}),
        ...(geography.lgaId ? { lgaId: geography.lgaId } : {}),
      },
    ];
  }

  private async resolveCanonicalGeography(input: AgencyRecommendationPreviewDto): Promise<CanonicalPreviewGeography> {
    if (input.wardId) {
      const ward = await this.prisma.ward.findFirst({
        where: { id: input.wardId, isActive: true },
        include: { lga: { include: { state: { include: { country: true } } } } },
      });
      if (!ward || ward.lgaId !== input.lgaId || ward.lga.stateId !== input.stateId
        || ward.lga.state.countryId !== input.countryId) {
        throw new BadRequestException("Ward/LGA/State/Country hierarchy mismatch");
      }
      return {
        countryId: ward.lga.state.countryId,
        countryName: ward.lga.state.country.name,
        stateId: ward.lga.stateId,
        stateName: ward.lga.state.name,
        lgaId: ward.lgaId,
        lgaName: ward.lga.name,
        wardId: ward.id,
        wardName: ward.name,
      };
    }
    if (input.lgaId) {
      const lga = await this.prisma.localGovernmentArea.findFirst({
        where: { id: input.lgaId, isActive: true },
        include: { state: { include: { country: true } } },
      });
      if (!lga || lga.stateId !== input.stateId || lga.state.countryId !== input.countryId) {
        throw new BadRequestException("LGA/State/Country hierarchy mismatch");
      }
      return {
        countryId: lga.state.countryId,
        countryName: lga.state.country.name,
        stateId: lga.stateId,
        stateName: lga.state.name,
        lgaId: lga.id,
        lgaName: lga.name,
        wardId: null,
        wardName: null,
      };
    }
    if (input.stateId) {
      const state = await this.prisma.administrativeState.findFirst({
        where: { id: input.stateId, countryId: input.countryId, isActive: true },
        include: { country: true },
      });
      if (!state) throw new BadRequestException("State/Country hierarchy mismatch");
      return {
        countryId: state.countryId,
        countryName: state.country.name,
        stateId: state.id,
        stateName: state.name,
        lgaId: null,
        lgaName: null,
        wardId: null,
        wardName: null,
      };
    }
    const country = await this.prisma.country.findFirst({ where: { id: input.countryId, isActive: true } });
    if (!country) throw new BadRequestException("Country not found");
    return {
      countryId: country.id,
      countryName: country.name,
      stateId: null,
      stateName: null,
      lgaId: null,
      lgaName: null,
      wardId: null,
      wardName: null,
    };
  }

  private assertPreviewCoordinates(latitude?: number, longitude?: number) {
    if ((latitude == null) !== (longitude == null)) {
      throw new BadRequestException("Latitude and longitude must be supplied together");
    }
    if (latitude === 0 && longitude === 0) {
      throw new BadRequestException("Latitude and longitude 0,0 are not a valid incident location");
    }
  }

  private isCurrent(value: unknown) {
    return value instanceof Date && value.getTime() >= Date.now() - VERIFICATION_FRESHNESS_MS;
  }

  private geographyLabel(geography: CanonicalPreviewGeography) {
    return geography.wardName ?? geography.lgaName ?? geography.stateName ?? geography.countryName;
  }

  private rankRows(
    rows: Array<Record<string, unknown>>,
    latitude: number,
    longitude: number,
    limit: number,
    forcedSource?: "postgis" | "haversine",
  ): AgencyRecommendation[] {
    const scored = rows
      .map((row) => {
        const hasCoordinatePair = row.latitude != null && row.longitude != null;
        const distanceMeters = row.distance_meters !== null && row.distance_meters !== undefined
          ? Number(row.distance_meters)
          : hasCoordinatePair
            ? haversineMeters(latitude, longitude, Number(row.latitude), Number(row.longitude))
            : null;
        const distanceSource =
          forcedSource ?? (row.distance_meters === null || row.distance_meters === undefined ? "haversine" : "postgis");
        const availableResponders = Number(row.available_responders ?? 0);
        const availableUnits = Number(row.available_units ?? 0);
        const activeAssignments = Number(row.active_assignments ?? 0);
        const escalationPriority = Number(row.escalation_priority ?? 0);
        const score =
          escalationPriority * 1000 +
          availableResponders * 50 +
          availableUnits * 30 -
          activeAssignments * 10 -
          (distanceMeters ?? 1_000_000_000) / 100;

        return {
          agencyId: String(row.id),
          name: String(row.name),
          type: String(row.type),
          serviceCategories: Array.isArray(row.service_categories) ? (row.service_categories as string[]) : [],
          distanceMeters,
          distanceSource,
          availableResponders,
          availableUnits,
          activeAssignments,
          escalationPriority,
          score,
          rank: 0,
        } satisfies AgencyRecommendation;
      })
      .sort((a, b) => b.score - a.score
        || (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (b.distanceMeters ?? Number.MAX_SAFE_INTEGER))
      .slice(0, limit)
      .map((row, index) => ({ ...row, rank: index + 1 }));

    return scored;
  }
}

export function compareAdvisoryRecommendations(
  left: AdvisoryAgencyRecommendation,
  right: AdvisoryAgencyRecommendation,
) {
  return TIER_ORDER[left.tier] - TIER_ORDER[right.tier]
    || right.factors.jurisdictionSpecificity - left.factors.jurisdictionSpecificity
    || Number(right.operationalReady) - Number(left.operationalReady)
    || Number(right.factors.verificationCurrent) - Number(left.factors.verificationCurrent)
    || right.factors.capabilityPriority - left.factors.capabilityPriority
    || (left.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (right.distanceMeters ?? Number.MAX_SAFE_INTEGER)
    || left.agencyName.localeCompare(right.agencyName)
    || (left.officeName ?? "").localeCompare(right.officeName ?? "");
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
