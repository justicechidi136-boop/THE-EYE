import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { UsersService } from "../users.service";
import { isCitizenProfileComplete } from "../profile-complete";

function createUsersService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    profile: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    emergencyContact: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    kycRecord: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    userPushToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $transaction: jest.fn(async (arg: unknown) => {
      if (typeof arg === "function") return (arg as (tx: unknown) => Promise<unknown>)(prisma);
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg;
    }),
    ...overrides,
  };

  const audit = { record: jest.fn().mockResolvedValue(undefined) };

  return {
    service: new UsersService(prisma as never, audit as never),
    prisma,
    audit,
  };
}

describe("isCitizenProfileComplete", () => {
  it("rejects empty jurisdiction and placeholder names", () => {
    expect(
      isCitizenProfileComplete({
        firstName: "Ada",
        lastName: "Okeke",
        country: "",
        state: "",
        lga: "",
      }),
    ).toBe(false);
    expect(
      isCitizenProfileComplete({
        firstName: "Google",
        lastName: "User",
        country: "Nigeria",
        state: "Lagos",
        lga: "Ikeja",
      }),
    ).toBe(false);
  });

  it("accepts complete real profiles", () => {
    expect(
      isCitizenProfileComplete({
        firstName: "Ada",
        lastName: "Okeke",
        country: "Nigeria",
        state: "Lagos",
        lga: "Ikeja",
      }),
    ).toBe(true);
  });
});

describe("UsersService.getMe", () => {
  it("returns citizen profile fields for authenticated users", async () => {
    const { service, prisma } = createUsersService();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "citizen@example.com",
      phone: "+2348012345678",
      status: "Active",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      profile: {
        firstName: "Ada",
        lastName: "Okeke",
        country: "Nigeria",
        state: "Lagos",
        lga: "Ikeja",
        avatarUrl: null,
        dateOfBirth: null,
        gender: null,
        address: null,
      },
      trustedReporter: { trustScore: 91, revokedAt: null },
      kycRecords: [{ status: "Verified", rejectionReason: null }],
      emergencyContacts: [
        { id: "c1", name: "Mum", phone: "+2348099990000", relationship: "Parent", priority: 1 },
      ],
    });

    const result = await service.getMe({
      sub: "user-1",
      typ: "user",
      role: "Citizen",
      permissions: [],
    } as never);

    expect(result).toEqual(
      expect.objectContaining({
        id: "user-1",
        displayName: "Ada Okeke",
        email: "citizen@example.com",
        kycStatus: "Verified",
        trustScore: 91,
        profileComplete: true,
        emergencyContact: expect.objectContaining({ phone: "+2348099990000" }),
      }),
    );
  });

  it("returns admin identity without requiring a citizen profile", async () => {
    const { service } = createUsersService();
    const result = await service.getMe({
      sub: "admin-1",
      typ: "admin",
      email: "admin@theeye.local",
      role: "Super Admin",
      permissions: ["user:manage"],
      country: "Nigeria",
    } as never);

    expect(result).toEqual(
      expect.objectContaining({
        id: "admin-1",
        typ: "admin",
        email: "admin@theeye.local",
        role: "Super Admin",
      }),
    );
  });
});

describe("UsersService.updateMe", () => {
  it("updates profile fields and records audit", async () => {
    const { service, prisma, audit } = createUsersService();
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        profile: {
          firstName: "Ada",
          lastName: "Okeke",
          country: "",
          state: "",
          lga: "",
          dateOfBirth: null,
          gender: null,
          address: null,
          avatarUrl: null,
        },
      })
      .mockResolvedValueOnce({
        id: "user-1",
        email: "citizen@example.com",
        phone: null,
        status: "Active",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        profile: {
          firstName: "Ada",
          lastName: "Okeke",
          country: "Nigeria",
          state: "Lagos",
          lga: "Ikeja",
          avatarUrl: null,
          dateOfBirth: null,
          gender: null,
          address: null,
        },
        trustedReporter: null,
        kycRecords: [],
        emergencyContacts: [],
      });

    const result = await service.updateMe(
      { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
      { country: "Nigeria", state: "Lagos", lga: "Ikeja" },
    );

    expect(prisma.profile.upsert).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "profile.updated" }),
    );
    expect(result.profileComplete).toBe(true);
  });

  it("rejects trust score mass assignment", async () => {
    const { service } = createUsersService();
    await expect(
      service.updateMe(
        { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
        { trustScore: 99 } as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("UsersService emergency contacts", () => {
  it("creates an emergency contact for the authenticated owner", async () => {
    const { service, prisma, audit } = createUsersService();
    prisma.emergencyContact.create.mockResolvedValue({
      id: "ec-1",
      name: "Chinwe",
      phone: "+2348099990000",
      relationship: "Spouse",
      priority: 1,
    });

    const result = await service.createEmergencyContact(
      { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
      { name: "Chinwe", phone: "08099990000", relationship: "Spouse" },
    );

    expect(result.phone).toBe("+2348099990000");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "emergency_contact.created" }),
    );
  });

  it("enforces ownership on delete", async () => {
    const { service, prisma } = createUsersService();
    prisma.emergencyContact.findFirst.mockResolvedValue(null);
    try {
      await service.deleteEmergencyContact(
        { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
        "missing",
      );
      throw new Error("Expected missing contact failure");
    } catch (error) {
      expect(String(error)).toContain("Emergency contact not found");
    }
  });
});

describe("UsersService KYC", () => {
  it("submits a pending KYC record", async () => {
    const { service, prisma, audit } = createUsersService();
    prisma.kycRecord.create.mockResolvedValue({
      id: "kyc-1",
      documentType: "NationalID",
      status: "Pending",
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
    });

    const result = await service.submitKyc(
      { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
      { documentType: "NationalID", documentNumber: "A123" },
    );

    expect(result.status).toBe("Pending");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "kyc.submitted" }));
  });

  it("rejects KYC review without user:manage", async () => {
    const { service } = createUsersService();
    await expect(
      service.reviewKyc(
        { sub: "admin-1", typ: "admin", role: "Call Center Agent", permissions: [] } as never,
        "kyc-1",
        { decision: "approve" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects duplicate pending KYC", async () => {
    const { service, prisma } = createUsersService();
    prisma.kycRecord.findFirst.mockResolvedValue({ status: "Pending" });
    await expect(
      service.submitKyc(
        { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
        { documentType: "NationalID" },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
