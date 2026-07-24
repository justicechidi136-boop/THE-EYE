import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { AdminRoleName } from "@the-eye/shared";
import {
  assertActorCanManagePolice,
  assertJurisdictionScope,
  assertSourceNotGoogleOnlyForOfficialVerification,
  normalizePhone,
  normalizeStationName,
  sanitizeSourceReference,
} from "../police-station-scope";

describe("police station scope helpers", () => {
  it("normalizes Nigerian local phone numbers", () => {
    expect(normalizePhone("08012345678")).toBe("+2348012345678");
    expect(normalizePhone("+2348012345678")).toBe("+2348012345678");
  });

  it("rejects unsafe source references", () => {
    expect(() => sanitizeSourceReference("<script>alert(1)</script>")).toThrow(BadRequestException);
    expect(sanitizeSourceReference("NPF Lagos directory page 12")).toBe("NPF Lagos directory page 12");
  });

  it("blocks Google-only sources for VerifiedOfficial", () => {
    expect(() => assertSourceNotGoogleOnlyForOfficialVerification("Google Places", "VerifiedOfficial")).toThrow(BadRequestException);
    expect(() => assertSourceNotGoogleOnlyForOfficialVerification("NPF official directory", "VerifiedOfficial")).not.toThrow();
  });

  it("allows only scoped admin roles to manage police records", () => {
    expect(() => assertActorCanManagePolice({ sub: "1", typ: "admin", role: AdminRoleName.CommunityModerator })).toThrow(ForbiddenException);
    expect(() => assertActorCanManagePolice({ sub: "1", typ: "admin", role: AdminRoleName.StateAdmin, country: "Nigeria", state: "Lagos" })).not.toThrow();
  });

  it("enforces state admin jurisdiction boundaries", () => {
    const actor = { sub: "1", typ: "admin" as const, role: AdminRoleName.StateAdmin, country: "Nigeria", state: "Lagos" };
    expect(() => assertJurisdictionScope(actor, { id: "j1", country: "Nigeria", state: "Abuja", lga: "Municipal" })).toThrow(ForbiddenException);
    expect(() => assertJurisdictionScope(actor, { id: "j1", country: "Nigeria", state: "Lagos", lga: "Ikeja" })).not.toThrow();
  });

  it("normalizes station names for duplicate checks", () => {
    expect(normalizeStationName("  Ikeja Central Police Station!!! ")).toBe("ikeja central police station");
  });
});
