import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { UsersService } from "../users.service";
import { isCitizenProfileComplete } from "../profile-complete";

function createUsersService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
    adminUserPreference: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    adminUser: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
    },
    adminRole: {
      findUnique: jest.fn(),
    },
    jurisdiction: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    agency: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    community: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    incident: { findMany: jest.fn().mockResolvedValue([]) },
    broadcast: { findMany: jest.fn().mockResolvedValue([]) },
    broadcastSighting: { findMany: jest.fn().mockResolvedValue([]) },
    communityPost: { findMany: jest.fn().mockResolvedValue([]) },
    incidentVerification: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { findMany: jest.fn().mockResolvedValue([]) },
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
    citizenVehicle: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      delete: jest.fn(),
    },
    citizenVehiclePhoto: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      delete: jest.fn(),
    },
    kycRecord: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    userPushToken: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
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

describe("UsersService operational account provisioning", () => {
  const stateAdmin = {
    sub: "state-admin",
    typ: "admin",
    role: "State Admin",
    permissions: ["user:manage"],
    country: "NG",
    state: "LA",
    lga: "Ikeja",
  } as never;

  it("creates a scoped field officer with a hashed password and audit record", async () => {
    const { service, prisma, audit } = createUsersService();
    const jurisdiction = { id: "jur-1", country: "NG", state: "LA", lga: "Ikeja" };
    prisma.agency.findUnique.mockResolvedValue({
      id: "agency-1",
      name: "Lagos Field Command",
      isActive: true,
      isFieldOperationsEnabled: true,
      jurisdiction,
    });
    prisma.adminRole.findUnique.mockResolvedValue({ id: "role-officer", name: "Police/Security Officer" });
    prisma.adminUser.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "officer-1",
      ...data,
      role: { name: "Police/Security Officer" },
      agency: { name: "Lagos Field Command" },
    }));

    const result = await service.createOperationalAdmin(stateAdmin, {
      accountType: "field_officer",
      displayName: "Officer Ada Okeke",
      email: "Ada.Okeke@Agency.gov.ng",
      password: "StrongPassword-123",
      agencyId: "agency-1",
    });

    const createCall = prisma.adminUser.create.mock.calls[0][0];
    expect(createCall.data.email).toBe("ada.okeke@agency.gov.ng");
    expect(createCall.data.passwordHash === "StrongPassword-123").toBe(false);
    expect(result.data.role).toBe("Police/Security Officer");
    expect(Object.prototype.hasOwnProperty.call(result.data, "password")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result.data, "passwordHash")).toBe(false);
    expect(JSON.stringify(audit.record.mock.calls[0][0]).includes("StrongPassword-123")).toBe(false);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.account.created" }));
  });

  it("creates a Sub-State account using the existing LGA Admin role", async () => {
    const { service, prisma } = createUsersService();
    prisma.jurisdiction.findUnique.mockResolvedValue({ id: "jur-2", country: "NG", state: "LA", lga: "Eti-Osa" });
    prisma.adminRole.findUnique.mockResolvedValue({ id: "role-lga", name: "LGA Admin" });
    prisma.adminUser.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "lga-admin-1",
      ...data,
      role: { name: "LGA Admin" },
      agency: null,
    }));

    const result = await service.createOperationalAdmin(stateAdmin, {
      accountType: "lga_admin",
      displayName: "Eti-Osa Administrator",
      email: "admin@eti-osa.gov.ng",
      password: "StrongPassword-456",
      jurisdictionId: "jur-2",
    });

    expect(result.data.role).toBe("LGA Admin");
    expect(result.data.scope).toBe("NG / LA / Eti-Osa");
  });

  it("rejects account creation outside the actor's state", async () => {
    const { service, prisma } = createUsersService();
    prisma.jurisdiction.findUnique.mockResolvedValue({ id: "jur-3", country: "NG", state: "FC", lga: "Abuja" });

    await expect(service.createOperationalAdmin(stateAdmin, {
      accountType: "lga_admin",
      displayName: "Out of scope",
      email: "admin@outside.gov.ng",
      password: "StrongPassword-789",
      jurisdictionId: "jur-3",
    })).rejects.toThrow("outside your admin scope");
    expect(prisma.adminUser.create).not.toHaveBeenCalled();
  });

  it("prevents an LGA Admin from creating another LGA Admin", async () => {
    const { service } = createUsersService();
    await expect(service.createOperationalAdmin({
      sub: "lga-admin",
      typ: "admin",
      role: "LGA Admin",
      permissions: ["user:manage"],
      country: "NG",
      state: "LA",
      lga: "Ikeja",
    } as never, {
      accountType: "lga_admin",
      displayName: "Peer Admin",
      email: "peer@ikeja.gov.ng",
      password: "StrongPassword-000",
      jurisdictionId: "jur-1",
    })).rejects.toThrow("cannot create this account type");
  });

  it("returns a scoped operational account without credential material", async () => {
    const { service, prisma } = createUsersService();
    prisma.adminUser.findFirst.mockResolvedValue({
      id: "officer-1",
      displayName: "Officer Ada Okeke",
      email: "ada.okeke@agency.gov.ng",
      passwordHash: "must-not-leak",
      country: "NG",
      state: "LA",
      lga: "Ikeja",
      isActive: true,
      createdAt: new Date("2026-08-25T10:00:00.000Z"),
      updatedAt: new Date("2026-08-25T10:00:00.000Z"),
      role: { name: "Police/Security Officer" },
      agency: { name: "Lagos Field Command" },
    });

    const result = await service.getAdminDetail(stateAdmin, "officer-1");

    expect(prisma.adminUser.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "officer-1", country: "NG", state: "LA" }),
      }),
    );
    expect(result.typ).toBe("admin");
    expect(result.role).toBe("Police/Security Officer");
    expect(Object.prototype.hasOwnProperty.call(result, "passwordHash")).toBe(false);
    expect(JSON.stringify(result).includes("must-not-leak")).toBe(false);
  });
});

describe("UsersService directory account-kind filtering", () => {
  it("does not query citizen UUIDs for the admin-only directory", async () => {
    const { service, prisma } = createUsersService();
    prisma.adminUser.findMany.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        createdAt: new Date("2026-08-25T12:00:00.000Z"),
        displayName: "Field Officer",
        email: "field@example.test",
        role: { name: "Police/Security Officer" },
        isActive: true,
        country: "NG",
        state: "LA",
        lga: "Ikeja",
        agency: { name: "Lagos Field Command" },
      },
    ]);

    const result = await service.listDirectory({
      sub: "state-admin",
      typ: "admin",
      role: "State Admin",
      country: "NG",
      state: "LA",
      permissions: ["user:manage"],
    } as never, { kind: "admin" });

    expect(prisma.adminUser.findMany).toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(result.data[0].role).toBe("Police/Security Officer");
  });

  it("applies combined directory search and geographic filters with authoritative metrics", async () => {
    const { service, prisma } = createUsersService();
    prisma.adminUser.count.mockResolvedValue(2);
    prisma.user.count.mockResolvedValue(3);

    const result = await service.listDirectory({
      sub: "super-admin",
      typ: "admin",
      role: "Super Admin",
      permissions: ["user:manage"],
    } as never, {
      q: "ada@example.test",
      status: "active",
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
      communityId: "community-1",
    });

    expect(prisma.adminUser.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "__deny_all__", country: "Nigeria", state: "Lagos", lga: "Ikeja", isActive: true }),
    }));
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "Active",
        profile: { is: { country: "Nigeria", state: "Lagos", lga: "Ikeja", homeCommunityId: "community-1" } },
      }),
    }));
    expect(result.meta.totalUsers).toBe(5);
    expect(result.meta.activeUsers).toBe(5);
    expect(result.meta.pendingUsers).toBe(3);
    expect(result.meta.deactivatedUsers).toBe(5);
  });

  it("returns scoped geographic options for directory filters", async () => {
    const { service, prisma } = createUsersService();
    prisma.jurisdiction.findMany.mockResolvedValue([{ id: "jur-1", country: "NG", state: "LA", lga: "Ikeja", name: "Ikeja" }]);
    prisma.community.findMany.mockResolvedValue([{ id: "community-1", country: "NG", state: "LA", lga: "Ikeja", name: "Allen Avenue" }]);

    const result = await service.listDirectoryOptions({
      sub: "state-admin",
      typ: "admin",
      role: "State Admin",
      country: "NG",
      state: "LA",
      permissions: ["user:manage"],
    } as never);

    expect(prisma.jurisdiction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ country: "NG", state: "LA" }),
    }));
    expect(result.data.communities[0].name).toBe("Allen Avenue");
  });
});

describe("UsersService operational user details", () => {
  const superAdmin = {
    sub: "super-admin",
    typ: "admin",
    role: "Super Admin",
    permissions: ["user:manage"],
  } as never;

  it("returns authoritative profile, operational activity and audit history", async () => {
    const { service, prisma } = createUsersService();
    prisma.user.findUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      email: "ada@example.test",
      phone: "+2348000000000",
      status: "Active",
      createdAt: new Date("2026-08-01T08:00:00.000Z"),
      updatedAt: new Date("2026-08-20T08:00:00.000Z"),
      profile: {
        firstName: "Ada", lastName: "Okeke", country: "Nigeria", countryCode: "NG",
        state: "Lagos", lga: "Ikeja", address: "Allen Avenue", avatarUrl: null,
        dateOfBirth: null, gender: null, preferredLocale: "en",
        homeCommunity: { id: "community-1", name: "Allen Avenue Estate" },
      },
      trustedReporter: null,
      kycRecords: [],
      emergencyContacts: [],
    });
    prisma.incident.findMany.mockResolvedValue([{
      id: "22222222-2222-4222-8222-222222222222", type: "Crime", title: "Road incident",
      status: "Submitted", priority: "P2ActiveCrimeAccident", address: "Allen Avenue",
      country: "Nigeria", state: "Lagos", lga: "Ikeja", assignedAgency: { name: "Ikeja Command" },
      submittedAt: new Date("2026-08-20T10:00:00.000Z"),
    }]);
    prisma.broadcast.findMany.mockResolvedValue([]);
    prisma.broadcastSighting.findMany.mockResolvedValue([]);
    prisma.communityPost.findMany.mockResolvedValue([]);
    prisma.incidentVerification.findMany.mockResolvedValue([]);
    prisma.auditLog.findMany.mockResolvedValue([{
      id: "audit-1", action: "account.created", actorType: "system", actorAdmin: null,
      actorUser: null, reason: null, beforeState: null, afterState: { status: "Active" },
      createdAt: new Date("2026-08-01T08:00:00.000Z"),
    }]);
    prisma.userPushToken.findFirst.mockResolvedValue({ lastSeenAt: new Date("2026-08-29T12:00:00.000Z") });

    const result = await service.getCitizenDetail(superAdmin, "11111111-1111-4111-8111-111111111111");

    expect(result.profile?.community?.name).toBe("Allen Avenue Estate");
    expect(result.reports[0].assignedAgency).toBe("Ikeja Command");
    expect(result.auditHistory[0].actor).toBe("System");
    expect(result.lastActiveAt).toBe("2026-08-29T12:00:00.000Z");
    expect(JSON.stringify(result).includes("objectKey")).toBe(false);
  });

  it("suspends a scoped citizen, revokes active sessions and records the reason", async () => {
    const { service, prisma, audit } = createUsersService();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1", status: "Active", profile: { country: "Nigeria", state: "Lagos", lga: "Ikeja" },
    });

    const result = await service.updateCitizenAccountStatus(superAdmin, "user-1", {
      status: "Suspended",
      reason: "Confirmed safety investigation",
    });

    expect(result.data.status).toBe("Suspended");
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    expect(prisma.userPushToken.updateMany).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: "account.suspended",
      reason: "Confirmed safety investigation",
      beforeState: { status: "Active" },
      afterState: { status: "Suspended" },
    }));
  });

  it("rejects account actions without a meaningful reason", async () => {
    const { service, prisma } = createUsersService();
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", status: "Active", profile: null });

    await expect(service.updateCitizenAccountStatus(superAdmin, "user-1", {
      status: "Deactivated",
      reason: " ",
    })).rejects.toThrow("A reason is required");
  });

  it("rejects account status mutations without user:manage", async () => {
    const { service, prisma } = createUsersService();
    const actorWithoutPermission = { ...superAdmin, permissions: [] };

    await expect(service.updateCitizenAccountStatus(actorWithoutPermission, "user-1", {
      status: "Suspended",
      reason: "Unauthorized mutation attempt",
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

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
        countryCode: "NG",
        preferredLocale: "ha",
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
        countryCode: "NG",
        preferredLocale: "ha",
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
        countryCode: "NG",
        preferredLocale: "ha",
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
        preferredLocale: "ha",
        effectivePreferredLocale: "ha",
        emergencyContact: expect.objectContaining({ phone: "+2348099990000" }),
      }),
    );
    expect(result.profile).toEqual(
      expect.objectContaining({
        countryCode: "NG",
        preferredLocale: "ha",
        effectivePreferredLocale: "ha",
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
          countryCode: null,
          preferredLocale: null,
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
          countryCode: "NG",
          preferredLocale: "yo",
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
      { country: "Nigeria", countryCode: "ng", preferredLocale: "YO", state: "Lagos", lga: "Ikeja" },
    );

    expect(prisma.profile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ countryCode: "NG", preferredLocale: "yo" }),
        update: expect.objectContaining({ countryCode: "NG", preferredLocale: "yo" }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "profile.updated" }),
    );
    expect(result.profileComplete).toBe(true);
    expect(result.effectivePreferredLocale).toBe("yo");
  });

  it("rejects unsupported language and country codes", async () => {
    const { service } = createUsersService();

    await expect(
      service.updateMe(
        { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
        { preferredLocale: "HAUSA" },
      ),
    ).rejects.toThrow("Unsupported preferredLocale");

    await expect(
      service.updateMe(
        { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
        { countryCode: "Nigeria" },
      ),
    ).rejects.toThrow("Unsupported countryCode");
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

describe("UsersService vehicle garage", () => {
  it("lists zero vehicles", async () => {
    const { service, prisma } = createUsersService();
    prisma.citizenVehicle.findMany.mockResolvedValue([]);
    const result = await service.listMyVehicles({
      sub: "user-1",
      typ: "user",
      role: "Citizen",
      permissions: [],
    } as never);
    expect(result).toEqual({ data: [] });
  });

  it("lists one two three vehicles without overwriting earlier entries", async () => {
    const { service, prisma } = createUsersService();
    prisma.citizenVehicle.findMany.mockResolvedValue([
      {
        id: "v1",
        userId: "user-1",
        make: "Toyota",
        model: "Corolla",
        year: 2020,
        color: "Silver",
        plateNumber: "ABC-111",
        vin: null,
        isPrimary: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-03T00:00:00.000Z"),
      },
      {
        id: "v2",
        userId: "user-1",
        make: "Honda",
        model: "Civic",
        year: 2021,
        color: "Black",
        plateNumber: "ABC-222",
        vin: null,
        isPrimary: false,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        id: "v3",
        userId: "user-1",
        make: "Lexus",
        model: "RX",
        year: 2022,
        color: "Blue",
        plateNumber: "ABC-333",
        vin: null,
        isPrimary: false,
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const result = await service.listMyVehicles({
      sub: "user-1",
      typ: "user",
      role: "Citizen",
      permissions: [],
    } as never);

    expect(result.data).toHaveLength(3);
    expect(result.data[0].plateNumber).toBe("ABC-111");
    expect(result.data[1].plateNumber).toBe("ABC-222");
    expect(result.data[2].plateNumber).toBe("ABC-333");
  });

  it("includes vehicle photos in vehicle list response", async () => {
    const { service, prisma } = createUsersService();
    prisma.citizenVehicle.findMany.mockResolvedValue([
      {
        id: "v1",
        userId: "user-1",
        make: "Toyota",
        model: "Corolla",
        year: 2020,
        color: "Silver",
        plateNumber: "ABC-111",
        vin: null,
        isPrimary: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-03T00:00:00.000Z"),
        photos: [
          {
            id: "p1",
            vehicleId: "v1",
            objectKey: "vehicles/user-1/v1/photo.jpg",
            contentType: "image/jpeg",
            angle: "FRONT",
            sizeBytes: 1400,
            sortOrder: 0,
            createdAt: new Date("2026-01-04T00:00:00.000Z"),
          },
        ],
      },
    ]);
    const result = await service.listMyVehicles({
      sub: "user-1",
      typ: "user",
      role: "Citizen",
      permissions: [],
    } as never);
    expect(result.data[0].photos).toHaveLength(1);
    expect(result.data[0].photos[0].objectKey).toContain("vehicles/user-1/v1");
  });

  it("creates first vehicle as primary and does not overwrite subsequent vehicles", async () => {
    const { service, prisma } = createUsersService();
    prisma.citizenVehicle.create.mockImplementation(async ({ data }: { data: any }) => ({
      id: "v-1",
      userId: data.userId,
      make: data.make,
      model: data.model,
      year: data.year ?? null,
      color: data.color ?? null,
      plateNumber: data.plateNumber,
      vin: data.vin ?? null,
      isPrimary: data.isPrimary ?? false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    }));
    prisma.citizenVehicle.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    const first = await service.createMyVehicle(
      { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
      { make: "Toyota", model: "Corolla", plateNumber: "abc-111" },
    );
    const second = await service.createMyVehicle(
      { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
      { make: "Honda", model: "Civic", plateNumber: "abc-222", isPrimary: false },
    );

    expect(first.isPrimary).toBe(true);
    expect(first.plateNumber).toBe("ABC-111");
    expect(second.isPrimary).toBe(false);
    expect(second.plateNumber).toBe("ABC-222");
    expect(prisma.citizenVehicle.updateMany).toHaveBeenCalledTimes(1);
  });

  it("enforces single primary when setting a vehicle as primary", async () => {
    const { service, prisma } = createUsersService();
    prisma.citizenVehicle.findFirst.mockResolvedValue({
      id: "v-2",
      userId: "user-1",
      make: "Honda",
      model: "Civic",
      year: 2020,
      color: "Black",
      plateNumber: "ABC-222",
      vin: null,
      isPrimary: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    prisma.citizenVehicle.update.mockResolvedValue({
      id: "v-2",
      userId: "user-1",
      make: "Honda",
      model: "Civic",
      year: 2020,
      color: "Black",
      plateNumber: "ABC-222",
      vin: null,
      isPrimary: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const result = await service.setMyVehiclePrimary(
      { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
      "v-2",
      true,
    );

    expect(prisma.citizenVehicle.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { isPrimary: false },
    });
    expect(result.isPrimary).toBe(true);
  });

  it("deletes non-primary vehicle without promoting another", async () => {
    const { service, prisma } = createUsersService();
    prisma.citizenVehicle.findFirst.mockResolvedValue({
      id: "v-2",
      userId: "user-1",
      make: "Honda",
      model: "Civic",
      year: 2020,
      color: "Black",
      plateNumber: "ABC-222",
      vin: null,
      isPrimary: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const result = await service.deleteMyVehicle(
      { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
      "v-2",
    );

    expect(result).toEqual({ ok: true });
    expect(prisma.citizenVehicle.delete).toHaveBeenCalledWith({ where: { id: "v-2" } });
    expect(prisma.citizenVehicle.update).not.toHaveBeenCalled();
  });

  it("deletes primary vehicle and promotes the most recently updated remaining one", async () => {
    const { service, prisma } = createUsersService();
    const findFirst = prisma.citizenVehicle.findFirst as jest.Mock;
    findFirst.mockImplementation((args: { where?: { id?: string } }) => {
      if (args?.where?.id === "v-primary") {
        return Promise.resolve({
          id: "v-primary",
          userId: "user-1",
          make: "Toyota",
          model: "Corolla",
          year: 2021,
          color: "Silver",
          plateNumber: "ABC-111",
          vin: null,
          isPrimary: true,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-03T00:00:00.000Z"),
        });
      }
      return Promise.resolve({
        id: "v-recent",
        userId: "user-1",
        make: "Lexus",
        model: "RX",
        year: 2022,
        color: "Blue",
        plateNumber: "ABC-333",
        vin: null,
        isPrimary: false,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-01-04T00:00:00.000Z"),
      });
    });

    await service.deleteMyVehicle(
      { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
      "v-primary",
    );

    expect(prisma.citizenVehicle.update).toHaveBeenCalledWith({
      where: { id: "v-recent" },
      data: { isPrimary: true },
    });
  });

  it("enforces ownership for get/update/delete", async () => {
    const { service, prisma } = createUsersService();
    prisma.citizenVehicle.findFirst.mockResolvedValue(null);
    await expect(
      service.getMyVehicle(
        { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
        "missing",
      ),
    ).rejects.toThrow("Vehicle not found");
    await expect(
      service.updateMyVehicle(
        { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
        "missing",
        { make: "Toyota" },
      ),
    ).rejects.toThrow("Vehicle not found");
    await expect(
      service.deleteMyVehicle(
        { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
        "missing",
      ),
    ).rejects.toThrow("Vehicle not found");
  });

  it("presigns vehicle photo upload for owned vehicle", async () => {
    const { service, prisma } = createUsersService();
    const vehicleId = "4f8ca2f6-3db5-4fd8-bf3b-bf2d66b92f8f";
    prisma.citizenVehicle.findFirst.mockResolvedValue({ id: vehicleId });
    prisma.citizenVehiclePhoto.count.mockResolvedValue(0);
    process.env.S3_ENDPOINT = "https://storage.example.com";
    process.env.S3_BUCKET = "the-eye";
    process.env.S3_ACCESS_KEY = "access-key";
    process.env.S3_SECRET_KEY = "secret-key";
    process.env.S3_REGION = "us-east-1";

    const result = await service.presignMyVehiclePhoto(
      { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
      vehicleId,
      { fileName: "front.jpg", contentType: "image/jpeg", sizeBytes: 320000 },
    );

    expect(result.objectKey).toMatch(
      /^vehicles\/user-1\/4f8ca2f6-3db5-4fd8-bf3b-bf2d66b92f8f\//,
    );
    expect(result.requiredHeaders).toEqual({ "content-type": "image/jpeg" });
  });

  it("rejects vehicle photo uploads after reaching the max of 8", async () => {
    const { service, prisma } = createUsersService();
    const vehicleId = "4f8ca2f6-3db5-4fd8-bf3b-bf2d66b92f8f";
    prisma.citizenVehicle.findFirst.mockResolvedValue({ id: vehicleId });
    prisma.citizenVehiclePhoto.count.mockResolvedValue(8);

    await expect(
      service.presignMyVehiclePhoto(
        { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
        vehicleId,
        { fileName: "front.jpg", contentType: "image/jpeg", sizeBytes: 320000 },
      ),
    ).rejects.toThrow("You can add up to 8 photos for each vehicle.");
  });

  it("confirms a vehicle photo and assigns sort order", async () => {
    const { service, prisma } = createUsersService();
    const vehicleId = "4f8ca2f6-3db5-4fd8-bf3b-bf2d66b92f8f";
    prisma.citizenVehicle.findFirst.mockResolvedValue({ id: vehicleId });
    prisma.citizenVehiclePhoto.count.mockResolvedValue(2);
    prisma.citizenVehiclePhoto.create.mockResolvedValue({
      id: "p-1",
      vehicleId,
      objectKey: `vehicles/user-1/${vehicleId}/photo.jpg`,
      contentType: "image/jpeg",
      angle: "REAR",
      sizeBytes: 1234,
      sortOrder: 2,
      createdAt: new Date("2026-01-04T00:00:00.000Z"),
    });

    const result = await service.confirmMyVehiclePhoto(
      { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
      vehicleId,
      {
        objectKey: `vehicles/user-1/${vehicleId}/4f8ca2f6-3db5-4fd8-bf3b-bf2d66b92f8f.jpg`,
        contentType: "image/jpeg",
        angle: "REAR",
        sizeBytes: 1234,
      },
    );

    expect(result.sortOrder).toBe(2);
    expect(result.angle).toBe("REAR");
    expect(prisma.citizenVehiclePhoto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ angle: "REAR" }),
      }),
    );
    expect(prisma.citizenVehiclePhoto.create).toHaveBeenCalled();
  });

  it("enforces ownership when deleting a vehicle photo", async () => {
    const { service, prisma } = createUsersService();
    prisma.citizenVehiclePhoto.findFirst.mockResolvedValue(null);

    await expect(
      service.deleteMyVehiclePhoto(
        { sub: "user-1", typ: "user", role: "Citizen", permissions: [] } as never,
        "4f8ca2f6-3db5-4fd8-bf3b-bf2d66b92f8f",
        "photo-1",
      ),
    ).rejects.toThrow("Vehicle photo not found");
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
