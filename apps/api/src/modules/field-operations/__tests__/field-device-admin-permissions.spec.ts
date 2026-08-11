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
  ] as const;

  it.each(supervisorRoles)("%s can approve field devices and holds manage/approve permissions", (role) => {
    expect(canApproveFieldDevices(role)).toBe(true);
    const permissions = adminRolePermissions[role];
    expect(permissions).toContain("field:device:manage");
    expect(permissions).toContain("field:device:approve");
  });

  it("does not grant field device manage to Police/Security Officer", () => {
    expect(canApproveFieldDevices(AdminRoleName.PoliceSecurityOfficer)).toBe(false);
    expect(adminRolePermissions[AdminRoleName.PoliceSecurityOfficer]).not.toContain("field:device:manage");
  });
});
