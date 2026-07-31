import { AdminRoleName } from "@the-eye/shared";
import { adminCanAccessGeography, adminGeographyWhere } from "../admin-geography-scope";
import type { JwtPayload } from "../jwt";

describe("admin geography scope", () => {
  const superAdmin: JwtPayload = {
    typ: "admin",
    sub: "super",
    role: AdminRoleName.SuperAdmin,
    permissions: [],
  };

  const countryAdmin: JwtPayload = {
    typ: "admin",
    sub: "country",
    role: AdminRoleName.CountryAdmin,
    country: "NG",
    permissions: [],
  };

  const stateAdmin: JwtPayload = {
    typ: "admin",
    sub: "state",
    role: AdminRoleName.StateAdmin,
    country: "NG",
    state: "Rivers",
    permissions: [],
  };

  it("allows super admin global access", () => {
    expect(adminGeographyWhere(superAdmin)).toEqual(null);
    expect(adminCanAccessGeography({ country: "NG", state: "Rivers", lga: "PHALGA" }, superAdmin)).toBe(true);
  });

  it("scopes country admins to their country", () => {
    expect(adminGeographyWhere(countryAdmin)).toEqual({ country: "NG" });
    expect(adminCanAccessGeography({ country: "NG", state: "Rivers" }, countryAdmin)).toBe(true);
    expect(adminCanAccessGeography({ country: "GH", state: "Accra" }, countryAdmin)).toBe(false);
  });

  it("scopes state admins to their state", () => {
    expect(adminGeographyWhere(stateAdmin)).toEqual({ country: "NG", state: "Rivers" });
    expect(adminCanAccessGeography({ country: "NG", state: "Rivers", lga: "PHALGA" }, stateAdmin)).toBe(true);
    expect(adminCanAccessGeography({ country: "NG", state: "Lagos" }, stateAdmin)).toBe(false);
  });
});
