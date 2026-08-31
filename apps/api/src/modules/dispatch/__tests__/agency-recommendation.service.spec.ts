import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  AGENCY_RECOMMENDATION_RULE_VERSION,
  AgencyRoutingService,
} from "../agency-routing.service";

const now = new Date();
const old = new Date("2020-01-01T00:00:00.000Z");
const actor = { typ: "admin", sub: "admin-1", role: "Super Admin" } as never;

function jurisdiction(level = "STATE", overrides: Record<string, unknown> = {}) {
  return {
    coverageType: level,
    countryId: "11111111-1111-1111-1111-111111111111",
    stateId: level === "NATIONAL" ? null : "22222222-2222-2222-2222-222222222222",
    lgaId: null,
    wardId: null,
    ...overrides,
  };
}

function office(overrides: Record<string, unknown> = {}) {
  return {
    id: "office-1",
    name: "Lagos Response Office",
    verificationStatus: "VERIFIED",
    verifiedAt: now,
    physicalAddress: "1 Response Road, Ikeja",
    addressVerified: true,
    addressSourceUrl: "https://agency.gov.ng/contact",
    addressVerifiedAt: now,
    latitude: 6.601,
    longitude: 3.351,
    coordinatesVerified: true,
    coordinateEvidenceClass: "AUTHORITATIVE_COORDINATE",
    coordinatesSourceUrl: "https://agency.gov.ng/map",
    coordinatesVerifiedAt: now,
    sourceUrl: "https://agency.gov.ng/offices",
    jurisdictions: [jurisdiction()],
    contacts: [{
      type: "EMERGENCY_PHONE",
      value: "112",
      label: "Emergency",
      emergencyOnly: true,
      lastVerifiedAt: now,
    }],
    ...overrides,
  };
}

function agency(type: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `agency-${type.toLowerCase()}`,
    code: `NG-${type.toUpperCase()}`,
    name: `${type} Agency`,
    verificationStatus: "VERIFIED",
    verifiedAt: now,
    verificationSource: "https://agency.gov.ng",
    escalationPriority: 1,
    incidentCapabilities: [{ incidentType: type, priority: 10, canReceiveReport: true }],
    directoryJurisdictions: [jurisdiction()],
    directoryContacts: [],
    offices: [office()],
    ...overrides,
  };
}

function buildService(agencies: Record<string, unknown>[] = [], stations: Record<string, unknown>[] = []) {
  const prisma = {
    country: { findFirst: jest.fn() },
    administrativeState: { findFirst: jest.fn().mockResolvedValue({
      id: "22222222-2222-2222-2222-222222222222",
      name: "Lagos",
      countryId: "11111111-1111-1111-1111-111111111111",
      country: { id: "11111111-1111-1111-1111-111111111111", name: "Nigeria" },
    }) },
    localGovernmentArea: { findFirst: jest.fn() },
    ward: { findFirst: jest.fn() },
    agency: { findMany: jest.fn().mockResolvedValue(agencies) },
    policeStation: { findMany: jest.fn().mockResolvedValue(stations) },
    incident: { update: jest.fn(), create: jest.fn() },
    dispatchEvent: { create: jest.fn() },
    notification: { create: jest.fn() },
    $queryRawUnsafe: jest.fn(),
  };
  return { prisma, service: new AgencyRoutingService(prisma as never) };
}

const request = {
  incidentType: "Fire",
  countryId: "11111111-1111-1111-1111-111111111111",
  stateId: "22222222-2222-2222-2222-222222222222",
  latitude: 6.6,
  longitude: 3.35,
  limit: 20,
};

describe("AgencyRoutingService advisory recommendations", () => {
  it("returns a verified operational fire endpoint as PRIMARY", async () => {
    const { service } = buildService([agency("Fire")]);
    const result = await service.preview(request, actor);
    expect(result.ruleVersion).toBe(AGENCY_RECOMMENDATION_RULE_VERSION);
    expect(result.actionableRecommendations[0].tier).toBe("PRIMARY");
    expect(result.actionableRecommendations[0].distanceMeters).not.toBe(null);
  });

  it("returns structural fire coverage with no fabricated distance", async () => {
    const structural = agency("Fire", { offices: [] });
    const { service } = buildService([structural]);
    const result = await service.preview(request, actor);
    expect(result.actionableRecommendations.length).toBe(0);
    expect(result.structuralMatches[0].tier).toBe("STRUCTURAL_ONLY");
    expect(result.structuralMatches[0].distanceMeters).toBe(null);
  });

  it("returns an explicit zero-actionable result when no fire record exists", async () => {
    const { service } = buildService([]);
    const result = await service.preview(request, actor);
    expect(result.actionableRecommendations.length).toBe(0);
    expect(result.limitations.length).toBe(1);
  });

  it("supports multiple road-crash agencies without forcing one winner", async () => {
    const candidates = ["FRSC", "Police", "Medical"].map((name, index) => agency("Accident", {
      id: `agency-${index}`,
      name,
      offices: [office({ id: `office-${index}`, name: `${name} endpoint` })],
    }));
    const { service } = buildService(candidates);
    const result = await service.preview({ ...request, incidentType: "Accident" }, actor);
    expect(result.actionableRecommendations.length).toBe(3);
  });

  it("keeps an FRSC structural command as non-actionable for a road crash", async () => {
    const frsc = agency("Accident", { name: "Federal Road Safety Corps", offices: [] });
    const { service } = buildService([frsc]);
    const result = await service.preview({ ...request, incidentType: "Accident" }, actor);
    expect(result.actionableRecommendations.length).toBe(0);
    expect(result.structuralMatches[0].agencyName).toBe("Federal Road Safety Corps");
  });

  it("keeps a fire command with unqualified coordinates out of physical ranking", async () => {
    const command = agency("Fire", { offices: [office({
      contacts: [],
      coordinatesVerified: false,
      coordinateEvidenceClass: "UNKNOWN",
      coordinatesSourceUrl: null,
    })] });
    const { service } = buildService([command]);
    const result = await service.preview(request, actor);
    expect(result.structuralMatches[0].distanceMeters).toBe(null);
    expect(result.meta.distanceQualifiedCount).toBe(0);
  });

  it("returns operational SEMA and structural NEMA together for disaster response", async () => {
    const sema = agency("Emergency", { name: "Lagos SEMA" });
    const nema = agency("Emergency", {
      id: "nema-id",
      name: "National Emergency Management Agency",
      directoryJurisdictions: [jurisdiction("NATIONAL")],
      offices: [],
    });
    const { service } = buildService([sema, nema]);
    const result = await service.preview({ ...request, incidentType: "Emergency" }, actor);
    expect(result.actionableRecommendations[0].agencyName).toBe("Lagos SEMA");
    expect(result.structuralMatches[0].agencyName).toBe("National Emergency Management Agency");
  });

  it("does not promote a partially verified disaster agency to actionable", async () => {
    const partial = agency("Emergency", {
      verificationStatus: "PARTIALLY_VERIFIED",
      name: "Partial SEMA",
      offices: [],
    });
    const { service } = buildService([partial]);
    const result = await service.preview({ ...request, incidentType: "Emergency" }, actor);
    expect(result.actionableRecommendations.length).toBe(0);
    expect(result.informationalMatches[0].tier).toBe("INFORMATIONAL");
  });

  it("adds a verified PoliceStation without converting it into an AgencyOffice", async () => {
    const npf = agency("Crime", { id: "npf-id", code: "NG-NPF", offices: [] });
    const station = {
      id: "station-1",
      agencyId: "npf-id",
      name: "Ikeja Police Station",
      address: "Ikeja, Lagos",
      state: "Lagos",
      lga: "Ikeja",
      verificationStatus: "VerifiedOfficial",
      verifiedAt: now,
      latitude: 6.6,
      longitude: 3.35,
      officialPhone: "+23410000000",
      emergencyPhone: null,
      phone: null,
      source: "official_directory",
      sourceReference: "https://police.gov.ng/stations",
      jurisdiction: { state: "Lagos", lga: "Ikeja" },
    };
    const { service } = buildService([npf], [station]);
    const result = await service.preview({ ...request, incidentType: "Crime" }, actor);
    expect(result.actionableRecommendations[0].endpointType).toBe("POLICE_STATION");
    expect(result.structuralMatches.length).toBe(1);
  });

  it("does not make a PoliceStation without coordinates actionable", async () => {
    const npf = agency("Crime", { id: "npf-id", code: "NG-NPF", offices: [] });
    const { service } = buildService([npf], [{
      id: "station-1", agencyId: "npf-id", name: "Station", address: "Lagos",
      state: "Lagos", verificationStatus: "VerifiedOfficial", verifiedAt: now,
      latitude: null, longitude: null, officialPhone: "+23410000000", jurisdiction: { state: "Lagos" },
    }]);
    const result = await service.preview({ ...request, incidentType: "Crime" }, actor);
    expect(result.informationalMatches[0].distanceMeters).toBe(null);
    expect(result.informationalMatches[0].operationalReady).toBe(false);
  });

  it("passes the canonical State filter to PoliceStation lookup", async () => {
    const npf = agency("Crime", { id: "npf-id", code: "NG-NPF", offices: [] });
    const { service, prisma } = buildService([npf]);
    await service.preview({ ...request, incidentType: "Crime" }, actor);
    expect(prisma.policeStation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isActive: true }),
    }));
  });

  it("prefers Ward then LGA then State then national jurisdiction", async () => {
    const { service } = buildService();
    const best = (service as any).bestJurisdiction([
      jurisdiction("NATIONAL"),
      jurisdiction("STATE"),
      jurisdiction("LGA", { lgaId: "lga-1" }),
      jurisdiction("WARD", { lgaId: "lga-1", wardId: "ward-1" }),
    ], {
      countryId: "11111111-1111-1111-1111-111111111111",
      stateId: "22222222-2222-2222-2222-222222222222",
      lgaId: "lga-1",
      wardId: "ward-1",
    });
    expect(best.level).toBe("WARD");
  });

  it("uses State fallback ahead of national fallback", async () => {
    const { service } = buildService();
    const best = (service as any).bestJurisdiction([
      jurisdiction("NATIONAL"),
      jurisdiction("STATE"),
    ], {
      countryId: "11111111-1111-1111-1111-111111111111",
      stateId: "22222222-2222-2222-2222-222222222222",
      lgaId: null,
      wardId: null,
    });
    expect(best.level).toBe("STATE");
  });

  it("supports existing custom coverage as jurisdiction evidence without distance", async () => {
    const custom = agency("CommunitySafety", {
      directoryJurisdictions: [jurisdiction("CUSTOM_COVERAGE_AREA")],
      offices: [],
    });
    const { service } = buildService([custom]);
    const result = await service.preview({ ...request, incidentType: "CommunitySafety" }, actor);
    expect(result.structuralMatches[0].jurisdictionLevel).toBe("CUSTOM_COVERAGE_AREA");
    expect(result.structuralMatches[0].distanceMeters).toBe(null);
  });

  it("includes exact State and national coverage filters without centroids", async () => {
    const { service, prisma } = buildService([agency("Fire")]);
    await service.preview(request, actor);
    expect(prisma.agency.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isActive: true }),
    }));
    const serialized = JSON.stringify(prisma.agency.findMany.mock.calls[0][0]);
    expect(serialized.includes("STATE")).toBe(true);
    expect(serialized.includes("NATIONAL")).toBe(true);
    expect(serialized.includes("centroid")).toBe(false);
  });

  it("denies an out-of-scope State admin preview", async () => {
    const { service } = buildService([agency("Fire")]);
    await expect(service.preview(request, {
      typ: "admin", sub: "admin-2", role: "State Admin",
      country: "Nigeria", state: "Rivers", permissions: ["agency:manage"],
    } as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects invalid 0,0 incident coordinates", async () => {
    const { service } = buildService();
    await expect(service.preview({ ...request, latitude: 0, longitude: 0 }, actor))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("never calculates distance for an unverified endpoint coordinate", async () => {
    const unsafe = agency("Fire", { offices: [office({ coordinatesVerified: false })] });
    const { service } = buildService([unsafe]);
    const result = await service.preview(request, actor);
    expect(result.actionableRecommendations[0].distanceMeters).toBe(null);
  });

  it("allows jurisdiction recommendations when incident coordinates are null", async () => {
    const { service } = buildService([agency("Fire")]);
    const result = await service.preview({
      ...request,
      latitude: undefined,
      longitude: undefined,
    }, actor);
    expect(result.actionableRecommendations[0].distanceMeters).toBe(null);
    expect(result.input.hasVerifiedCoordinates).toBe(false);
  });

  it("ranks verified operational evidence ahead of partial structural evidence", async () => {
    const verified = agency("Fire", { id: "verified", name: "Verified endpoint" });
    const partial = agency("Fire", {
      id: "partial", name: "Partial structure", verificationStatus: "PARTIALLY_VERIFIED", offices: [],
    });
    const { service } = buildService([partial, verified]);
    const result = await service.preview(request, actor);
    expect(result.actionableRecommendations[0].agencyId).toBe("verified");
    expect(result.informationalMatches[0].agencyId).toBe("partial");
  });

  it("downgrades stale endpoint evidence", async () => {
    const stale = agency("Fire", { offices: [office({ verifiedAt: old, addressVerifiedAt: old })] });
    const { service } = buildService([stale]);
    const result = await service.preview(request, actor);
    expect(result.actionableRecommendations.length).toBe(0);
    expect(result.structuralMatches.length).toBe(1);
  });

  it("is deterministic and repeatable for the same database state", async () => {
    const { service } = buildService([agency("Fire")]);
    const first = await service.preview(request, actor);
    const second = await service.preview(request, actor);
    expect(first.meta.candidateIds).toEqual(second.meta.candidateIds);
    expect(first.actionableRecommendations).toEqual(second.actionableRecommendations);
  });

  it("does not mutate incidents, enqueue work, or create outbound communication", async () => {
    const { service, prisma } = buildService([agency("Fire")]);
    const result = await service.preview(request, actor);
    expect(prisma.incident.update.mock.calls.length).toBe(0);
    expect(prisma.incident.create.mock.calls.length).toBe(0);
    expect(prisma.dispatchEvent.create.mock.calls.length).toBe(0);
    expect(prisma.notification.create.mock.calls.length).toBe(0);
    expect(result.meta.outboundCommunicationCalls).toBe(0);
    expect(result.meta.incidentStateChanged).toBe(false);
  });

  it("does not fabricate legacy routing distance from incident coordinates", () => {
    const { service } = buildService();
    const ranked = (service as any).rankRows([{
      id: "agency-1", name: "Structural agency", type: "fire", service_categories: ["fire"],
      escalation_priority: 1, latitude: null, longitude: null, distance_meters: null,
    }], 6.6, 3.35, 1, "haversine");
    expect(ranked[0].distanceMeters).toBe(null);
  });
});
