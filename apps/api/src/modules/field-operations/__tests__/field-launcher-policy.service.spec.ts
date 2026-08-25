import { FieldLauncherPolicyService } from "../field-launcher-policy.service";

describe("FieldLauncherPolicyService", () => {
  function createService() {
    const prisma = {
      fieldDevice: {
        findUnique: jest.fn(),
      },
      fieldDeviceLauncherPolicy: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
      },
    };
    const audit = { record: jest.fn() };
    const service = new FieldLauncherPolicyService(prisma as never, audit as never);
    return { prisma, audit, service };
  }

  it("returns locked policy for revoked devices", async () => {
    const { prisma, service } = createService();
    prisma.fieldDevice.findUnique.mockResolvedValueOnce({
      id: "dev-1",
      publicDeviceId: "FD-1",
      agencyId: "agency-1",
      isRevoked: true,
      isLost: false,
      registrationStatus: "Active",
      launcherPolicy: {
        deviceMode: "launcher",
        launcherEnabled: true,
        kioskEnabled: false,
        approvedApps: ["com.google.android.apps.maps"],
        settingsAccessLevel: "restricted",
        maintenanceModeAllowed: true,
        emergencyDialerAllowed: true,
        browserAllowed: true,
        screenshotsAllowed: false,
        usbPolicy: "charge_only",
        autoLockMinutes: 10,
        visibleModules: ["patrol"],
        role: "officer",
        policyVersion: 2,
        updatedAt: new Date("2026-08-09T00:00:00.000Z"),
      },
      agency: null,
    });

    const dto = await service.getPolicyForFieldSession({
      typ: "field",
      sub: "officer-1",
      fieldDeviceId: "dev-1",
      fieldRole: "officer",
    } as never);

    expect(dto.locked).toBe(true);
    expect(dto.lockReason).toBe("Device revoked");
    expect(dto.deviceMode).toBe("launcher");
    expect(dto.emergencyDialerAllowed).toBe(true);
  });

  it("patches admin policy and audits", async () => {
    const { prisma, audit, service } = createService();
    prisma.fieldDevice.findUnique.mockResolvedValueOnce({
      id: "dev-1",
      publicDeviceId: "FD-1",
      agencyId: "agency-1",
    });
    prisma.fieldDeviceLauncherPolicy.findUnique.mockResolvedValueOnce(null);
    prisma.fieldDeviceLauncherPolicy.upsert.mockResolvedValueOnce({
      deviceMode: "managed_kiosk",
      launcherEnabled: true,
      kioskEnabled: true,
      approvedApps: ["com.google.android.apps.maps"],
      settingsAccessLevel: "supervisor",
      maintenanceModeAllowed: false,
      emergencyDialerAllowed: true,
      browserAllowed: false,
      screenshotsAllowed: false,
      usbPolicy: "deny",
      autoLockMinutes: 5,
      visibleModules: ["dashboard"],
      role: "supervisor",
      policyVersion: 1,
      updatedAt: new Date("2026-08-09T00:00:00.000Z"),
    });

    const dto = await service.patchPolicyForAdmin(
      "dev-1",
      { typ: "admin", sub: "admin-1" } as never,
      { deviceMode: "managed_kiosk", kioskEnabled: true, role: "supervisor" },
    );

    expect(dto.deviceMode).toBe("managed_kiosk");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "field.device.launcher_policy_updated" }),
    );
  });

  it("includes broadcasts in default policies for every field role", async () => {
    const roles = ["officer", "patrol", "checkpoint", "drone", "supervisor", "commander"];

    for (const role of roles) {
      const { prisma, service } = createService();
      prisma.fieldDevice.findUnique.mockResolvedValueOnce({
        id: `dev-${role}`,
        publicDeviceId: `FD-${role}`,
        agencyId: "agency-1",
        isRevoked: false,
        isLost: false,
        registrationStatus: "Active",
        launcherPolicy: null,
        agency: null,
      });
      prisma.fieldDeviceLauncherPolicy.upsert.mockResolvedValueOnce({
        fieldDeviceId: `dev-${role}`,
        deviceMode: "standard",
        launcherEnabled: false,
        kioskEnabled: false,
        approvedApps: [],
        settingsAccessLevel: "none",
        maintenanceModeAllowed: true,
        emergencyDialerAllowed: true,
        browserAllowed: true,
        screenshotsAllowed: true,
        usbPolicy: "allow",
        autoLockMinutes: 15,
        visibleModules: ["broadcasts"],
        role,
        policyVersion: 1,
        updatedAt: new Date("2026-08-25T00:00:00.000Z"),
      });

      const dto = await service.getPolicyForFieldSession({
        typ: "field",
        sub: "officer-1",
        fieldDeviceId: `dev-${role}`,
        fieldRole: role,
      } as never);

      const create = prisma.fieldDeviceLauncherPolicy.upsert.mock.calls[0]?.[0]?.create;
      expect(create.visibleModules.includes("broadcasts")).toBe(true);
      expect(dto.visibleModules.includes("broadcasts")).toBe(true);
    }
  });

  it("rejects invalid deviceMode", async () => {
    const { prisma, service } = createService();
    prisma.fieldDevice.findUnique.mockResolvedValueOnce({ id: "dev-1", publicDeviceId: "FD-1" });
    await expect(
      service.patchPolicyForAdmin("dev-1", { typ: "admin", sub: "admin-1" } as never, {
        deviceMode: "rootkit",
      }),
    ).rejects.toThrow(/deviceMode/);
  });
});
