import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  AGENCY_ERROR_CODES,
  AdminRoleName,
  AgencyCapability,
  AgencyType,
  FieldOperationalRole,
} from "@the-eye/shared";
import { AgenciesService } from "../agencies.service";

describe("AgenciesService", () => {
  function createService() {
    const prisma = {
      agency: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      responseUnit: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const service = new AgenciesService(prisma as never);
    return { prisma, service };
  }

  function actor(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      sub: "admin-1",
      typ: "admin" as const,
      role: AdminRoleName.StateAdmin,
      country: "NG",
      state: "LA",
      lga: "IKEJA",
      permissions: ["agency:manage"],
      ...overrides,
    };
  }

  const agencyRow = {
    id: "agency-1",
    code: "NG-LAG-IKEJA-POLICE",
    name: "Ikeja Police",
    shortName: "Ikeja",
    type: AgencyType.Police,
    jurisdictionLevel: "LGA",
    countryCode: "NG",
    stateCode: "LA",
    lgaCode: "IKEJA",
    capabilities: [AgencyCapability.FieldOperations],
    isActive: true,
    status: "Active",
    isFieldOperationsEnabled: true,
    isDispatchable: true,
    isDroneEnabled: false,
    isBroadcastAuthority: false,
    isGovernment: true,
    isEmergencyResponder: true,
    parentAgencyId: null,
    jurisdictionId: null,
    phone: null,
    email: null,
    serviceCategories: [],
  };

  it("lists agencies scoped to the actor state", async () => {
    const { service, prisma } = createService();
    prisma.agency.findMany.mockResolvedValue([agencyRow]);

    const result = await service.list(actor(), { isFieldOperationsEnabled: "true" });

    expect(prisma.agency.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { countryCode: "NG", stateCode: "LA" },
            { isFieldOperationsEnabled: true },
          ]),
        }),
      }),
    );
    expect(result.data[0].code).toBe("NG-LAG-IKEJA-POLICE");
  });

  it("denies create of a national agency for State Admin", async () => {
    const { service } = createService();
    await expect(
      service.create(actor(), {
        code: "NG-NPF",
        name: "NPF",
        type: AgencyType.Police,
        jurisdictionLevel: "COUNTRY",
        countryCode: "NG",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: AGENCY_ERROR_CODES.OUTSIDE_JURISDICTION }),
    });
  });

  it("rejects FO assignment when agency FO flag is off", async () => {
    const { service, prisma } = createService();
    prisma.agency.findUnique.mockResolvedValue({
      ...agencyRow,
      isFieldOperationsEnabled: false,
    });

    await expect(
      service.assertFieldOperationsAssignment({
        actor: actor(),
        agencyId: "agency-1",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: AGENCY_ERROR_CODES.FIELD_OPS_DISABLED }),
    });
  });

  it("rejects unit that does not belong to the agency", async () => {
    const { service, prisma } = createService();
    prisma.agency.findUnique.mockResolvedValue(agencyRow);
    prisma.responseUnit.findFirst.mockResolvedValue(null);

    await expect(
      service.assertFieldOperationsAssignment({
        actor: actor(),
        agencyId: "agency-1",
        assignedUnitId: "unit-x",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: AGENCY_ERROR_CODES.UNIT_NOT_IN_AGENCY }),
    });
  });

  it("rejects operational roles not allowed for the agency type", async () => {
    const { service, prisma } = createService();
    prisma.agency.findUnique.mockResolvedValue({
      ...agencyRow,
      type: AgencyType.Ems,
    });

    await expect(
      service.assertFieldOperationsAssignment({
        actor: actor(),
        agencyId: "agency-1",
        operationalRole: FieldOperationalRole.PatrolOfficer,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: AGENCY_ERROR_CODES.ROLE_NOT_PERMITTED }),
    });
  });

  it("returns not found for missing agency detail", async () => {
    const { service, prisma } = createService();
    prisma.agency.findUnique.mockResolvedValue(null);
    await expect(service.getById(actor({ role: AdminRoleName.SuperAdmin }), "missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("Agency Admin cannot create unrelated agencies", async () => {
    const { service } = createService();
    await expect(
      service.create(actor({ role: AdminRoleName.AgencyAdmin, agencyId: "agency-1" }), {
        code: "NG-OTHER",
        name: "Other",
        type: AgencyType.Police,
        jurisdictionLevel: "LGA",
        countryCode: "NG",
        stateCode: "LA",
        lgaCode: "IKEJA",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects unknown capabilities on create", async () => {
    const { service } = createService();
    await expect(
      service.create(actor({ role: AdminRoleName.SuperAdmin }), {
        code: "NG-X",
        name: "X",
        type: AgencyType.Police,
        jurisdictionLevel: "COUNTRY",
        countryCode: "NG",
        capabilities: ["NOT_A_REAL_CAP"],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("requires provenance before marking an agency verified", async () => {
    const { service } = createService();
    await expect(
      service.create(actor({ role: AdminRoleName.SuperAdmin }), {
        code: "NG-VERIFIED",
        name: "Verified agency",
        type: AgencyType.Police,
        jurisdictionLevel: "COUNTRY",
        countryCode: "NG",
        governmentLevel: "FEDERAL",
        verificationStatus: "VERIFIED",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("prevents State Admin mutation of a federal agency through the legacy agency endpoint", async () => {
    const { service, prisma } = createService();
    prisma.agency.findUnique.mockResolvedValue({
      ...agencyRow,
      governmentLevel: "FEDERAL",
      verificationStatus: "VERIFIED",
      verificationSource: "https://agency.gov.ng/",
    });

    await expect(service.update(actor(), "agency-1", { name: "Changed" })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
