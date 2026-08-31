import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { AgencyDirectoryService } from "../agency-directory.service";

describe("AgencyDirectoryService", () => {
  function buildService() {
    const prisma = {
      agency: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
      agencyOffice: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      agencyContact: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      agencyJurisdiction: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      agencyIncidentCapability: { findUnique: jest.fn(), upsert: jest.fn() },
      country: { findFirst: jest.fn() },
      ward: { findFirst: jest.fn() },
      localGovernmentArea: { findFirst: jest.fn() },
      administrativeState: { findFirst: jest.fn(), findMany: jest.fn() },
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    return { prisma, audit, service: new AgencyDirectoryService(prisma as never, audit as never) };
  }

  const agency = {
    id: "agency-1",
    code: "NG-FFS",
    name: "Federal Fire Service",
    officialName: "Federal Fire Service",
    shortName: "FFS",
    aliases: [],
    description: "Federal fire and rescue service",
    type: "FIRE_RESCUE",
    governmentLevel: "FEDERAL",
    officialWebsite: "https://www.fedfire.gov.ng/",
    verificationSource: "private-admin-source",
    dataQualityNotes: "private-admin-note",
    directoryContacts: [
      { id: "contact-1", type: "EMERGENCY_PHONE", value: "+2348032003557", label: "Emergency", emergencyOnly: true },
    ],
    incidentCapabilities: [{ incidentType: "Fire", canReceiveReport: true }],
  };

  it("reports stale and incomplete verification metadata without exposing contact values", async () => {
    const { prisma, service } = buildService();
    prisma.administrativeState.findMany.mockResolvedValue([
      { id: "state-1", code: "LA", name: "Lagos", type: "STATE" },
    ]);
    prisma.agency.findMany.mockResolvedValue([
      {
        id: "agency-1",
        code: "NG-LAGOS-TEST",
        name: "Test agency",
        verificationStatus: "VERIFIED",
        verifiedAt: null,
        verificationSource: "https://lagosstate.gov.ng/test",
        officialWebsite: null,
        isActive: true,
        offices: [],
        directoryContacts: [
          {
            id: "contact-1",
            officeId: null,
            type: "PHONE",
            label: "Public line",
            isActive: true,
            publiclyVerified: true,
            verificationStatus: "VERIFIED",
            sourceUrl: "https://lagosstate.gov.ng/test",
            lastVerifiedAt: new Date("2020-01-01T00:00:00.000Z"),
            value: "+2348000000000",
          },
        ],
      },
    ]);

    const result = await service.getVerificationFreshnessReport(
      { typ: "admin", sub: "admin-1", role: "State Admin", country: "NG", state: "Lagos" } as never,
      { staleDays: 365 },
    );

    expect(result.data.some((finding) => finding.issue === "VERIFIED_MISSING_DATE")).toBe(true);
    expect(result.data.some((finding) => finding.issue === "MISSING_OFFICIAL_URL")).toBe(true);
    expect(result.data.some((finding) => finding.issue === "STALE_VERIFICATION")).toBe(true);
    expect(JSON.stringify(result.data).includes("+2348000000000")).toBe(false);
  });

  it("reports verified State agencies and federal formations against canonical States", async () => {
    const { prisma, service } = buildService();
    prisma.administrativeState.findMany.mockResolvedValue([
      { id: "lagos-id", code: "LA", name: "Lagos", type: "STATE" },
    ]);
    prisma.agency.findMany.mockResolvedValue([
      {
        id: "lasema-id",
        code: "NG-LAGOS-LASEMA",
        name: "LASEMA",
        type: "STATE_EMERGENCY_AGENCY",
        stateCode: "Lagos",
        verificationStatus: "VERIFIED",
        offices: [],
      },
      {
        id: "frsc-id",
        code: "NG-FRSC",
        name: "FRSC",
        type: "ROAD_SAFETY",
        stateCode: null,
        verificationStatus: "VERIFIED",
        offices: [
          { id: "frsc-lagos", stateId: "lagos-id", name: "FRSC Lagos Sector Command", verificationStatus: "VERIFIED" },
        ],
      },
    ]);

    const result = await service.getCoverageReport(
      { typ: "admin", sub: "admin-1", role: "Super Admin" } as never,
      {},
    );

    expect(result.data[0].emergencyManagement.status).toBe("VERIFIED");
    expect(result.data[0].frscCommand.status).toBe("VERIFIED");
    expect(result.data[0].policeCommand.status).toBe("NOT_VERIFIED");
    expect(result.meta.semantics.includes("does not mean the service is absent")).toBe(true);
  });

  it("scopes coverage geography to the State admin's canonical State", async () => {
    const { prisma, service } = buildService();
    prisma.administrativeState.findMany.mockResolvedValue([
      { id: "lagos-id", code: "LA", name: "Lagos", type: "STATE" },
    ]);
    prisma.agency.findMany.mockResolvedValue([]);

    await service.getCoverageReport(
      { typ: "admin", sub: "admin-1", role: "State Admin", country: "NG", state: "Lagos" } as never,
      {},
    );

    const stateWhere = prisma.administrativeState.findMany.mock.calls[0][0].where;
    expect(stateWhere.OR[0].name.equals).toBe("Lagos");
    expect(stateWhere.country.code).toBe("NG");
  });

  it("returns a verified federal agency with only public contact fields", async () => {
    const { prisma, service } = buildService();
    prisma.agency.findMany.mockResolvedValue([agency]);

    const result = await service.list({ type: "FIRE_RESCUE", limit: 50 });

    expect(result.data[0].name).toBe("Federal Fire Service");
    expect(result.data[0].contacts[0].value).toBe("+2348032003557");
    expect(Object.prototype.hasOwnProperty.call(result.data[0], "verificationSource")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result.data[0], "dataQualityNotes")).toBe(false);
  });

  it("includes national and matching State/LGA/Ward jurisdictions", async () => {
    const { prisma, service } = buildService();
    prisma.ward.findFirst.mockResolvedValue({ id: "ward-1", lgaId: "lga-1", lga: { stateId: "state-1" } });
    prisma.agency.findMany.mockResolvedValue([]);

    await service.list({ stateId: "state-1", lgaId: "lga-1", wardId: "ward-1", limit: 50 });

    const query = prisma.agency.findMany.mock.calls[0][0];
    expect(query.where.directoryJurisdictions.some).toEqual({
      isActive: true,
      OR: [
        { coverageType: "NATIONAL" },
        { coverageType: "STATE", stateId: "state-1" },
        { coverageType: "LGA", lgaId: "lga-1" },
        { coverageType: "WARD", wardId: "ward-1" },
      ],
    });
  });

  it("rejects a Ward paired with the wrong LGA", async () => {
    const { prisma, service } = buildService();
    prisma.ward.findFirst.mockResolvedValue({ id: "ward-1", lgaId: "lga-1", lga: { stateId: "state-1" } });

    await expect(
      service.list({ lgaId: "different-lga", wardId: "ward-1", limit: 50 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("orders only verified-coordinate offices by nearest distance", async () => {
    const { prisma, service } = buildService();
    prisma.agencyOffice.findMany.mockResolvedValue([
      {
        id: "office-far",
        name: "Far office",
        officeType: "STATE_OFFICE",
        physicalAddress: "Far",
        latitude: 6.7,
        longitude: 3.6,
        agency: { id: "a2", name: "Agency 2", shortName: null, type: "OTHER" },
        contacts: [],
      },
      {
        id: "office-near",
        name: "Near office",
        officeType: "LOCAL_OFFICE",
        physicalAddress: "Near",
        latitude: 6.5001,
        longitude: 3.4001,
        agency: { id: "a1", name: "Agency 1", shortName: null, type: "OTHER" },
        contacts: [],
      },
    ]);

    const result = await service.nearby({ lat: 6.5, lng: 3.4, radiusMeters: 100000 });

    expect(result.data[0].id).toBe("office-near");
  });

  it("does not let a State Admin mutate a federal directory record", async () => {
    const { prisma, service } = buildService();
    prisma.agency.findUnique.mockResolvedValue({
      id: "agency-1",
      countryCode: "NG",
      stateCode: null,
      lgaCode: null,
      governmentLevel: "FEDERAL",
    });

    await expect(
      service.createContact(
        { typ: "admin", sub: "admin-1", role: "State Admin", country: "NG", state: "Lagos" } as never,
        "agency-1",
        {
          type: "PHONE",
          value: "+2348000000000",
          publiclyVerified: false,
          verificationStatus: "PENDING_VERIFICATION",
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects a public contact without verified provenance", async () => {
    const { prisma, service } = buildService();
    prisma.agency.findUnique.mockResolvedValue({
      id: "agency-1",
      countryCode: "NG",
      stateCode: null,
      lgaCode: null,
      governmentLevel: "FEDERAL",
    });

    await expect(
      service.createContact(
        { typ: "admin", sub: "admin-1", role: "Super Admin" } as never,
        "agency-1",
        {
          type: "EMERGENCY_PHONE",
          value: "+2348000000000",
          publiclyVerified: true,
          verificationStatus: "VERIFIED",
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates an audited office only under a valid canonical hierarchy", async () => {
    const { prisma, audit, service } = buildService();
    prisma.agency.findUnique.mockResolvedValue({
      id: "agency-1",
      countryCode: "NG",
      stateCode: null,
      lgaCode: null,
      governmentLevel: "FEDERAL",
    });
    prisma.localGovernmentArea.findFirst.mockResolvedValue({
      stateId: "state-1",
      state: { countryId: "country-1" },
    });
    prisma.agencyOffice.create.mockResolvedValue({ id: "office-1", name: "Verified office" });

    const result = await service.createOffice(
      { typ: "admin", sub: "admin-1", role: "Super Admin" } as never,
      "agency-1",
      {
        countryId: "country-1",
        stateId: "state-1",
        lgaId: "lga-1",
        name: "Verified office",
        officeType: "LOCAL_OFFICE",
        verificationStatus: "VERIFIED",
        sourceUrl: "https://agency.gov.ng/offices",
      },
    );

    expect(result.data.id).toBe("office-1");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "agency.directory_office_created", entityId: "office-1" }),
    );
  });
});
