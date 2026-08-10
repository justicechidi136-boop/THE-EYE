import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { AdminRoleName, FIELD_ERROR_CODES, FIELD_PERM_ERROR_CODES, FieldPreProvisionStatus, FieldProvisioningMode } from "@the-eye/shared";
import { FieldDevicePreprovisionService } from "../field-device-preprovision.service";
import { FieldPermissionPolicyService } from "../field-permission-policy.service";

describe("FieldDevicePreprovisionService", () => {
  function createService() {
    const prisma = {
      fieldDevice: {
        create: jest.fn(),
        update: jest.fn(),
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

    const service = new FieldDevicePreprovisionService(
      prisma as never,
      audit as never,
      devices as never,
      devicesAdmin as never,
      profiles as never,
      policy,
    );

    return { prisma, audit, devices, devicesAdmin, profiles, policy, service };
  }

  function actor(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      sub: "admin-1",
      typ: "admin" as const,
      role: AdminRoleName.AgencyAdmin,
      agencyId: "agency-1",
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
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
      service.preprovision(actor({ role: AdminRoleName.StateAdmin, state: "Lagos" }), {
        deviceName: "Tablet 1",
        stateCode: "Kano",
      } as never),
    ).rejects.toMatchObject({ response: { code: FIELD_ERROR_CODES.JURISDICTION_MISMATCH } });
  });

  it("rejects a permission profile whose permissions exceed the actor's delegation authority", async () => {
    const { service, profiles } = createService();
    profiles.requireActiveProfile.mockResolvedValue({
      id: "profile-1",
      code: "supervisor_profile",
      permissions: ["field:supervisor:manage"],
    });

    await expect(
      service.preprovision(actor({ role: AdminRoleName.LgaAdmin }), {
        deviceName: "Tablet 1",
        permissionProfileId: "profile-1",
      } as never),
    ).rejects.toMatchObject({ response: { code: FIELD_PERM_ERROR_CODES.DELEGATION_EXCEEDS_AUTHORITY } });
  });

  it("rejects unknown/arbitrary permission strings supplied as per-device overrides", async () => {
    const { service } = createService();
    await expect(
      service.preprovision(actor(), {
        deviceName: "Tablet 1",
        permissionOverrides: ["field:definitely-not-real"],
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it("creates a draft pre-provisioned device with an authority snapshot when the request is valid", async () => {
    const { service, prisma, profiles, audit } = createService();
    profiles.requireActiveProfile.mockResolvedValue({
      id: "profile-1",
      code: "patrol_officer_baseline",
      permissions: ["field:access", "field:session:operate", "field:patrol:operate"],
    });
    prisma.fieldDevice.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: "device-1",
      ...data,
    }));

    const result = await service.preprovision(actor(), {
      deviceName: "  Patrol Tablet 07  ",
      operationalRole: "PatrolOfficer",
      permissionProfileId: "profile-1",
    } as never);

    expect(prisma.fieldDevice.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.fieldDevice.create.mock.calls[0][0].data;
    expect(createArgs.provisioningMode).toBe(FieldProvisioningMode.PreProvisioned);
    expect(createArgs.preProvisionStatus).toBe(FieldPreProvisionStatus.Draft);
    expect(createArgs.permissionProfileId).toBe("profile-1");
    expect(createArgs.deviceName).toBe("Patrol Tablet 07");
    expect(createArgs.authoritySnapshot).toMatchObject({
      grantedByAdminId: "admin-1",
      profileCode: "patrol_officer_baseline",
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "field.device.preprovisioned" }));
    expect(result.data).toMatchObject({ id: "device-1" });
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
