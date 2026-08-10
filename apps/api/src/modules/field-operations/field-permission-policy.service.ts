import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import {
  AdminRoleName,
  FIELD_PERM_ERROR_CODES,
  type Permission,
  resolveEffectiveFieldPermissions,
  validateFieldPermissionCatalog,
  validateFieldPermissionDelegation,
} from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";

export type AuthoritySnapshot = {
  grantedByAdminId: string;
  grantedByRole: string;
  ceiling: Permission[];
  grantedPermissions: Permission[];
  profileId: string | null;
  profileCode: string | null;
  overrides: Permission[];
  denies: Permission[];
  snapshotAt: string;
};

/**
 * Central delegation envelope for field permission decisions. Ensures no admin can
 * grant a field device/officer more capability than their own authority ceiling
 * allows (see FIELD_SUPERVISOR_GRANT_CEILINGS in packages/shared), and rejects any
 * permission string that is not part of the known field capability catalog.
 */
@Injectable()
export class FieldPermissionPolicyService {
  /** Validates a raw permission string list came from the known catalog — never trust UI-supplied strings directly. */
  assertKnownPermissions(permissions: readonly string[]): Permission[] {
    const check = validateFieldPermissionCatalog(permissions);
    if (!check.valid) {
      throw new BadRequestException({
        code: FIELD_PERM_ERROR_CODES.UNKNOWN_PERMISSION,
        message: `Unknown field permission(s): ${check.unknown.join(", ")}`,
      });
    }
    return check.known;
  }

  /** Throws if `requestedPermissions` exceed what `actor`'s admin role may delegate. */
  assertWithinAuthority(actor: JwtPayload, requestedPermissions: readonly Permission[]): Permission[] {
    const result = this.checkAuthority(actor, requestedPermissions);
    if (!result.allowed) {
      throw new ForbiddenException({
        code: FIELD_PERM_ERROR_CODES.DELEGATION_EXCEEDS_AUTHORITY,
        message: `Role "${actor.role}" cannot delegate: ${result.excess.join(", ")}`,
        excess: result.excess,
      });
    }
    return result.ceiling;
  }

  /** Non-throwing variant for preview/dry-run tooling. */
  checkAuthority(actor: JwtPayload, requestedPermissions: readonly Permission[]) {
    const role = (actor.role ?? "") as AdminRoleName;
    return validateFieldPermissionDelegation(role, requestedPermissions);
  }

  /** Full validation pipeline for a permission set an admin wants to grant (profile create/update, pre-provision, override). */
  validateGrant(actor: JwtPayload, permissions: readonly string[]): Permission[] {
    const known = this.assertKnownPermissions(permissions);
    this.assertWithinAuthority(actor, known);
    return known;
  }

  resolveEffective(
    profilePermissions: readonly Permission[],
    overrides: readonly Permission[] = [],
    denies: readonly Permission[] = [],
  ): Permission[] {
    return resolveEffectiveFieldPermissions(profilePermissions, overrides, denies);
  }

  buildAuthoritySnapshot(input: {
    actor: JwtPayload;
    profileId: string | null;
    profileCode: string | null;
    grantedPermissions: Permission[];
    overrides?: Permission[];
    denies?: Permission[];
  }): AuthoritySnapshot {
    const role = (input.actor.role ?? "") as AdminRoleName;
    const ceiling = validateFieldPermissionDelegation(role, []).ceiling;
    return {
      grantedByAdminId: input.actor.sub,
      grantedByRole: input.actor.role ?? "unknown",
      ceiling,
      grantedPermissions: input.grantedPermissions,
      profileId: input.profileId,
      profileCode: input.profileCode,
      overrides: input.overrides ?? [],
      denies: input.denies ?? [],
      snapshotAt: new Date().toISOString(),
    };
  }
}
