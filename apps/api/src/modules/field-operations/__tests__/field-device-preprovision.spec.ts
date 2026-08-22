import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import {
  AGENCY_ERROR_CODES,
  AdminRoleName,
  FIELD_ERROR_CODES,
  FIELD_PERM_ERROR_CODES,
  FieldPreProvisionStatus,
  FieldProvisioningMode,
} from "@the-eye/shared";
import { FieldDevicePreprovisionService } from "../field-device-preprovision.service";
import { FieldPermissionPolicyService } from "../field-permission-policy.service";

describe("FieldDevicePreprovisionService", () => {
  function createService() {
    const prisma = {
      fieldDevice: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      adminUser: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
    };
    const audit = { record: jest.fn() };
    const devices = {
      mapDevice: jest.fn((device: unknown) => device),
    };
    const devicesAdmin = {
      assertSupervisor: jest.fn(),
      requireScopedDevice: jest.fn(),
    };
    const profiles = {
      requireActiveProfile: jest.fn(),
    };
    const policy = new FieldPermissionPolicyService();
    const agencies = {
      assertFieldOperationsAssignment: jest.fn().mockResolvedValue({
        id: "agency-1",
        countryCode: "NG",
        stateCode: "LA",
        lgaCode: "IKEJA",
      }),
    };

    const service = new FieldDevicePreprovisionService(
      prisma as never,
      audit as never,
      devices as never,
      devicesAdmin as never,
      profiles as never,
      policy,
      agencies as never,
    );

    return { prisma, audit, devices, devicesAdmin, profiles, policy, agencies, service };
  }

  function actor(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      sub: "admin-1",
      typ: "admin" as const,
      role: AdminRoleName.AgencyAdmin,
      agencyId: "agency-1",
      country: "NG",
      state: "LA",
      lga: "IKEJA",
      ...overrides,
    };
  }

  it("rejects preprovisioning when the actor is not a supervisor role", async () => {
    const { service, devicesAdmin } = createService();
    devicesAdmin.assertSupervisor.mockImplementation(() => {
      throw new ForbiddenException({ code: FIELD_ERROR_CODES.JURISDICTION_MISMATCH, message: "Supervisor scope required" });
    });

    await expect(
      service.preprovision(actor({ role: AdminRoleName.PoliceSecurityOfficer }), { deviceName: "Tablet 1" } as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects preprovisioning outside the actor's jurisdiction scope", async () => {
    const { service } = createService();
    await expect(
      service.preprovision(actor({ role: AdminRoleName.StateAdmin, state: "LA" }), {
        deviceName: "Tablet 1",
        agencyId: "agency-1",
        stateCode: "KN",
      } as never),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: FIELD_ERROR_CODES.JURISDICTION_MISMATCH }),
    });
  });

  it("rejects when agencyId is missing", async () => {
    const { service } = createService();
    await expect(
      service.preprovision(actor({ agencyId: null }), {
        deviceName: "Tablet 1",
      } as never),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: AGENCY_ERROR_CODES.NOT_FOUND }),
    });
  });

  it("rejects a permission profile whose permissions exceed the actor's delegation authority", async () => {
    const { service, profiles } = createService();
    profiles.requireActiveProfile.mockResolvedValue({
      id: "profile-1",
      code: "supervisor_profile",
      permissions: ["field:supervisor:manage"],
      compatibleAgencyTypes: [],
    });

    await expect(
      service.preprovision(actor({ role: AdminRoleName.LgaAdmin }), {
        deviceName: "Tablet 1",
        agencyId: "agency-1",
        permissionProfileId: "profile-1",
      } as never),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: FIELD_PERM_ERROR_CODES.DELEGATION_EXCEEDS_AUTHORITY }),
    });
  });

  it("rejects unknown/arbitrary permission strings supplied as per-device overrides", async () => {
    const { service } = createService();
    await expect(
      service.preprovision(actor(), {
        deviceName: "Tablet 1",
        agencyId: "agency-1",
        permissionOverrides: ["field:definitely-not-real"],
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it("creates a draft pre-provisioned device with an authority snapshot when the request is valid", async () => {
    const { service, prisma, profiles, audit, agencies } = createService();
    profiles.requireActiveProfile.mockResolvedValue({
      id: "profile-1",
      code: "patrol_officer_baseline",
      permissions: ["field:access", "field:session:operate", "field:patrol:operate"],
      compatibleAgencyTypes: ["POLICE"],
    });
    prisma.fieldDevice.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: "device-1",
      ...data,
    }));

    const result = await service.preprovision(actor(), {
      deviceName: "  Patrol Tablet 07  ",
      agencyId: "agency-1",
      operationalRole: "PatrolOfficer",
      permissionProfileId: "profile-1",
    } as never);

    expect(agencies.assertFieldOperationsAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: "agency-1",
        compatibleAgencyTypes: ["POLICE"],
      }),
    );
    expect(prisma.fieldDevice.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.fieldDevice.create.mock.calls[0][0].data;
    expect(createArgs.provisioningMode).toBe(FieldProvisioningMode.PreProvisioned);
    expect(createArgs.preProvisionStatus).toBe(FieldPreProvisionStatus.Draft);
    expect(createArgs.permissionProfileId).toBe("profile-1");
    expect(createArgs.deviceName).toBe("Patrol Tablet 07");
    expect(createArgs.agencyId).toBe("agency-1");
    expect(createArgs.authoritySnapshot.grantedByAdminId).toBe("admin-1");
    expect(createArgs.authoritySnapshot.profileCode).toBe("patrol_officer_baseline");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "field.device.preprovisioned" }));
    expect(result.data.id).toBe("device-1");
  });

  it("rejects a malformed assigned officer before Prisma create", async () => {
    const { service, prisma } = createService();

    const request = service.preprovision(actor(), {
        deviceName: "Patrol Tablet 08",
        agencyId: "agency-1",
        assignedUserId: "0001",
      } as never);
    await expect(request).rejects.toThrow(BadRequestException);
    await expect(request).rejects.toMatchObject({ status: 400 });

    expect(prisma.fieldDevice.create).not.toHaveBeenCalled();
  });

  it("accepts an active field officer in the selected agency scope", async () => {
    const { service, prisma } = createService();
    prisma.adminUser.findUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      displayName: "Officer One",
      isActive: true,
      agencyId: "agency-1",
      country: "NG",
      state: "LA",
      lga: "IKEJA",
      role: { name: AdminRoleName.PoliceSecurityOfficer },
    });
    prisma.fieldDevice.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: "device-1",
      ...data,
    }));

    await service.preprovision(actor(), {
      deviceName: "Patrol Tablet 09",
      agencyId: "agency-1",
      assignedUserId: "11111111-1111-4111-8111-111111111111",
    } as never);

    expect(prisma.fieldDevice.create.mock.calls[0][0].data.assignedUserId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("rejects an assigned officer outside the selected agency scope", async () => {
    const { service, prisma } = createService();
    prisma.adminUser.findUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      isActive: true,
      agencyId: "agency-2",
      country: "NG",
      state: "KN",
      lga: "KANO",
      role: { name: AdminRoleName.PoliceSecurityOfficer },
    });

    const request = service.preprovision(actor(), {
        deviceName: "Patrol Tablet 10",
        agencyId: "agency-1",
        assignedUserId: "11111111-1111-4111-8111-111111111111",
      } as never);
    await expect(request).rejects.toThrow(ForbiddenException);
    await expect(request).rejects.toMatchObject({ status: 403 });
  });

  it("returns a conflict for a duplicate inventory asset reference", async () => {
    const { service, prisma } = createService();
    prisma.fieldDevice.findFirst.mockResolvedValue({ id: "existing-device" });

    const request = service.preprovision(actor(), {
        deviceName: "Patrol Tablet 11",
        agencyId: "agency-1",
        inventoryAssetRef: "INV-FT-001",
      } as never);
    await expect(request).rejects.toThrow(ConflictException);
    await expect(request).rejects.toMatchObject({ status: 409 });
  });

  it("creates a device when optional assignment fields are omitted", async () => {
    const { service, prisma } = createService();
    prisma.fieldDevice.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: "device-optional",
      ...data,
    }));

    await service.preprovision(actor(), { deviceName: "Unassigned Tablet", agencyId: "agency-1" } as never);

    const createData = prisma.fieldDevice.create.mock.calls[0][0].data;
    expect(createData.assignedUserId).toBe(null);
    expect(createData.registrationStatus).toBe("PendingApproval");
    expect(createData.activationPolicy).toBe("RequireSupervisorFinalApproval");
  });

  it("blocks editing provisioning once the device has moved past pairing", async () => {
    const { service, devicesAdmin } = createService();
    devicesAdmin.requireScopedDevice.mockResolvedValue({
      id: "device-1",
      provisioningMode: FieldProvisioningMode.PreProvisioned,
      preProvisionStatus: FieldPreProvisionStatus.Active,
    });

    await expect(service.updateProvisioning("device-1", actor(), { notes: "late edit" })).rejects.toThrow(BadRequestException);
  });
});
