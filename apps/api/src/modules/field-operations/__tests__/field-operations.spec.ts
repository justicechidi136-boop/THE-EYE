import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { FieldDeviceRegistrationStatus, FIELD_ERROR_CODES } from "@the-eye/shared";
import { FieldDevicesService } from "../field-devices.service";
import { FieldAuthService } from "../field-auth.service";
import { FieldDevicesAdminService } from "../field-devices-admin.service";

function createDevicesService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    fieldDeviceRegistrationChallenge: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    fieldDevice: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    adminUser: { findUnique: jest.fn() },
    ...overrides,
  };
  const audit = { record: jest.fn() };
  const config = { get: jest.fn().mockReturnValue("staging") };
  const service = Object.create(FieldDevicesService.prototype) as FieldDevicesService;
  Object.assign(service, { prisma, audit, config });
  return { service, prisma, audit };
}

function expectForbiddenCode(fn: () => void, code: string) {
  try {
    fn();
    throw new Error("Expected ForbiddenException");
  } catch (error) {
    if (error instanceof Error && error.message === "Expected ForbiddenException") throw error;
    expect(error).toBeInstanceOf(ForbiddenException);
    const response = (error as ForbiddenException).getResponse() as { code?: string };
    expect(response.code).toBe(code);
  }
}

describe("FieldDevicesService", () => {
  it("creates registration challenge", async () => {
    const { service, prisma } = createDevicesService();
    prisma.fieldDeviceRegistrationChallenge.create.mockResolvedValue({
      id: "ch-1",
      expiresAt: new Date(Date.now() + 60000),
    });
    const result = await service.createRegistrationChallenge();
    expect(result.data.challengeId).toBe("ch-1");
    expect(typeof result.data.challenge).toBe("string");
    expect(result.data.challenge.length).toBeGreaterThan(10);
  });

  it("rejects citizen-only style registration without admin actor", async () => {
    const { service } = createDevicesService();
    await expect(
      service.registerDevice({ typ: "user", sub: "u1", permissions: [] }, {} as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("blocks pending device from operational auth assertion", () => {
    const { service } = createDevicesService();
    expectForbiddenCode(
      () =>
        service.assertDeviceCanAuthenticate({
          registrationStatus: FieldDeviceRegistrationStatus.PendingApproval,
          isLost: false,
          isRevoked: false,
          requiresRePair: false,
        }),
      FIELD_ERROR_CODES.DEVICE_APPROVAL_PENDING,
    );
  });

  it("blocks lost device", () => {
    const { service } = createDevicesService();
    expectForbiddenCode(
      () =>
        service.assertDeviceCanAuthenticate({
          registrationStatus: FieldDeviceRegistrationStatus.Active,
          isLost: true,
          isRevoked: false,
          requiresRePair: false,
        }),
      FIELD_ERROR_CODES.DEVICE_MARKED_LOST,
    );
  });

  it("blocks revoked device", () => {
    const { service } = createDevicesService();
    expectForbiddenCode(
      () =>
        service.assertDeviceCanAuthenticate({
          registrationStatus: FieldDeviceRegistrationStatus.Revoked,
          isLost: false,
          isRevoked: true,
          requiresRePair: false,
        }),
      FIELD_ERROR_CODES.DEVICE_REVOKED,
    );
  });

  it("blocks re-pair required device", () => {
    const { service } = createDevicesService();
    expectForbiddenCode(
      () =>
        service.assertDeviceCanAuthenticate({
          registrationStatus: FieldDeviceRegistrationStatus.Active,
          isLost: false,
          isRevoked: false,
          requiresRePair: true,
        }),
      FIELD_ERROR_CODES.DEVICE_REPAIR_REQUIRED,
    );
  });

  it("throws when registration status queried for unknown device", async () => {
    const { service, prisma } = createDevicesService();
    prisma.fieldDevice.findUnique.mockResolvedValue(null);
    await expect(service.getRegistrationStatus({ publicDeviceId: "missing" })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("FieldDevicesAdminService", () => {
  it("denies out-of-scope supervisor approval", async () => {
    const prisma = {
      fieldDevice: { findUnique: jest.fn().mockResolvedValue({ id: "d1", stateCode: "AB", lgaCode: "X", agencyId: "a1", countryCode: "NG" }) },
    };
    const audit = { record: jest.fn() };
    const devices = { mapDevice: jest.fn((d) => d) };
    const service = Object.create(FieldDevicesAdminService.prototype) as FieldDevicesAdminService;
    Object.assign(service, { prisma, audit, devices });
    await expect(
      service.approve("d1", { typ: "admin", sub: "s1", role: "Agency Admin", agencyId: "other", country: "NG", state: "LA", lga: "Ikeja", permissions: [] }, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("denies non-supervisor device management", async () => {
    const service = Object.create(FieldDevicesAdminService.prototype) as FieldDevicesAdminService;
    Object.assign(service, { prisma: {}, audit: { record: jest.fn() }, devices: {} });
    await expect(
      service.list({ typ: "admin", sub: "s1", role: "Police/Security Officer", permissions: [], country: "NG", state: "LA", lga: "Ikeja" }, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("FieldAuthService", () => {
  it("rejects refresh when token version mismatches", async () => {
    const prisma = {
      fieldDevice: {
        findUnique: jest.fn().mockResolvedValue({
          id: "d1",
          publicDeviceId: "fd_test",
          registrationStatus: "Active",
          isLost: false,
          isRevoked: false,
          requiresRePair: false,
          tokenVersion: 2,
        }),
      },
      fieldDeviceSession: {
        findFirst: jest.fn().mockResolvedValue({ id: "s1", tokenVersion: 1, adminUserId: "a1", sessionId: "sess", adminUser: { role: { name: "Police/Security Officer" } } }),
        update: jest.fn(),
      },
    };
    const devices = {
      assertDeviceCanAuthenticate: jest.fn(),
      loadAdminActor: jest.fn(),
      mapDevice: jest.fn(),
    };
    const service = Object.create(FieldAuthService.prototype) as FieldAuthService;
    Object.assign(service, { prisma, audit: { record: jest.fn() }, config: { get: jest.fn() }, devices });
    await expect(service.refresh({ refreshToken: "rt", publicDeviceId: "fd_test" })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
