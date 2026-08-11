import {
  AdminRoleName,
  adminRolePermissions,
  canApproveFieldDevices,
} from "@the-eye/shared";

describe("field device admin permission matrix", () => {
  const supervisorRoles = [
    AdminRoleName.SuperAdmin,
    AdminRoleName.CountryAdmin,
    AdminRoleName.StateAdmin,
    AdminRoleName.LgaAdmin,
    AdminRoleName.AgencyAdmin,
  ];

  it("supervisor roles can approve field devices and hold manage/approve permissions", () => {
    for (const role of supervisorRoles) {
      expect(canApproveFieldDevices(role)).toBe(true);
      const permissions = adminRolePermissions[role];
      expect(permissions).toContain("field:device:manage");
      expect(permissions).toContain("field:device:approve");
    }
  });

  it("does not grant field device manage to Police/Security Officer", () => {
    expect(canApproveFieldDevices(AdminRoleName.PoliceSecurityOfficer)).toBe(false);
    expect(adminRolePermissions[AdminRoleName.PoliceSecurityOfficer]).not.toContain("field:device:manage");
  });
});
