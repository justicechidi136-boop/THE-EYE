import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { AdminRoleName, FIELD_PERM_ERROR_CODES } from "@the-eye/shared";
import { FieldPermissionPolicyService } from "../field-permission-policy.service";

describe("FieldPermissionPolicyService", () => {
  function actor(role: AdminRoleName, sub = "admin-1") {
    return { sub, typ: "admin" as const, role };
  }

  function createService() {
    return new FieldPermissionPolicyService();
  }

  describe("assertKnownPermissions", () => {
    it("rejects arbitrary/unknown permission strings from the UI", () => {
      const service = createService();
      expect(() => service.assertKnownPermissions(["field:incident:view", "field:make-me-super-admin"])).toThrow(
        BadRequestException,
      );
    });

    it("rejects admin-console-only permissions not assignable to a device profile", () => {
      const service = createService();
      // field:device:register is a real Permission, but not part of the device-assignable catalog.
      expect(() => service.assertKnownPermissions(["field:device:register"])).toThrow(BadRequestException);
    });

    it("accepts every permission from the known catalog", () => {
      const service = createService();
      expect(() =>
        service.assertKnownPermissions(["field:incident:view", "field:patrol:operate", "field:backup:request"]),
      ).not.toThrow();
    });
  });

  describe("assertWithinAuthority", () => {
    it("allows a Country Admin to delegate broad field capability permissions", () => {
      const service = createService();
      expect(() =>
        service.assertWithinAuthority(actor(AdminRoleName.CountryAdmin), ["field:patrol:operate", "field:supervisor:manage"]),
      ).not.toThrow();
    });

    it("blocks a non-supervisor role (Police/Security Officer) from delegating any field permission", () => {
      const service = createService();
      try {
        service.assertWithinAuthority(actor(AdminRoleName.PoliceSecurityOfficer), ["field:incident:view"]);
        throw new Error("expected assertWithinAuthority to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        const response = (error as ForbiddenException).getResponse() as { code: string; excess: string[] };
        expect(response.code).toBe(FIELD_PERM_ERROR_CODES.DELEGATION_EXCEEDS_AUTHORITY);
        expect(response.excess).toContain("field:incident:view");
      }
    });

    it("blocks an LGA Admin from delegating field:supervisor:manage (reserved for state+)", () => {
      const service = createService();
      expect(() => service.assertWithinAuthority(actor(AdminRoleName.LgaAdmin), ["field:supervisor:manage"])).toThrow(
        ForbiddenException,
      );
      expect(() => service.assertWithinAuthority(actor(AdminRoleName.LgaAdmin), ["field:patrol:operate"])).not.toThrow();
    });

    it("allows an Agency Admin to delegate field:supervisor:manage", () => {
      const service = createService();
      expect(() =>
        service.assertWithinAuthority(actor(AdminRoleName.AgencyAdmin), ["field:supervisor:manage"]),
      ).not.toThrow();
    });
  });

  describe("validateGrant", () => {
    it("runs catalog validation before authority validation", () => {
      const service = createService();
      expect(() => service.validateGrant(actor(AdminRoleName.CountryAdmin), ["not-a-real-permission"])).toThrow(
        BadRequestException,
      );
    });
  });

  describe("resolveEffective", () => {
    it("applies overrides additively and denies subtractively, with deny taking precedence", () => {
      const service = createService();
      const effective = service.resolveEffective(
        ["field:incident:view", "field:map:view"],
        ["field:patrol:operate", "field:map:view"],
        ["field:map:view"],
      );
      expect(effective.sort()).toEqual(["field:incident:view", "field:patrol:operate"].sort());
    });
  });

  describe("buildAuthoritySnapshot", () => {
    it("captures grantor identity, ceiling, and granted permissions at the time of grant", () => {
      const service = createService();
      const snapshot = service.buildAuthoritySnapshot({
        actor: actor(AdminRoleName.AgencyAdmin, "admin-42"),
        profileId: "profile-1",
        profileCode: "patrol_officer_baseline",
        grantedPermissions: ["field:incident:view"],
      });
      expect(snapshot.grantedByAdminId).toBe("admin-42");
      expect(snapshot.grantedByRole).toBe(AdminRoleName.AgencyAdmin);
      expect(snapshot.profileCode).toBe("patrol_officer_baseline");
      expect(snapshot.ceiling.length).toBeGreaterThan(0);
      expect(typeof snapshot.snapshotAt).toBe("string");
    });
  });
});
