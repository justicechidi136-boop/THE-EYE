import { ForbiddenException } from "@nestjs/common";
import { AdminRoleName, AGENCY_ERROR_CODES } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { adminCanAccessGeography } from "../../common/auth/admin-geography-scope";

export type AgencyScopeRow = {
  id: string;
  countryCode: string;
  stateCode: string | null;
  lgaCode: string | null;
  parentAgencyId?: string | null;
};

export function assertCanReadAgency(actor: JwtPayload, agency: AgencyScopeRow): void {
  if (actor.role === AdminRoleName.SuperAdmin) return;

  if (actor.role === AdminRoleName.AgencyAdmin) {
    if (actor.agencyId && (actor.agencyId === agency.id || actor.agencyId === agency.parentAgencyId)) {
      return;
    }
    throwAgencyScope();
  }

  const ok = adminCanAccessGeography(
    {
      country: agency.countryCode,
      state: agency.stateCode ?? undefined,
      lga: agency.lgaCode ?? undefined,
    },
    actor,
  );
  if (!ok) throwAgencyScope();
}

export function assertCanManageAgency(actor: JwtPayload, agency?: AgencyScopeRow | null): void {
  if (actor.role === AdminRoleName.SuperAdmin) return;

  if (
    actor.role !== AdminRoleName.CountryAdmin &&
    actor.role !== AdminRoleName.StateAdmin &&
    actor.role !== AdminRoleName.LgaAdmin &&
    actor.role !== AdminRoleName.AgencyAdmin
  ) {
    throwAgencyScope();
  }

  if (!agency) {
    // create path — constrain by actor geography / agency lock below in service
    if (actor.role === AdminRoleName.AgencyAdmin && !actor.agencyId) throwAgencyScope();
    return;
  }

  assertCanReadAgency(actor, agency);

  if (actor.role === AdminRoleName.AgencyAdmin && actor.agencyId !== agency.id) {
    // Agency admins may only manage their own agency (not create unrelated nationals)
    throwAgencyScope();
  }
}

export function agencyListWhere(actor: JwtPayload): Record<string, unknown> {
  if (actor.role === AdminRoleName.SuperAdmin) return {};

  if (actor.role === AdminRoleName.AgencyAdmin) {
    if (!actor.agencyId) return { id: "__none__" };
    return {
      OR: [{ id: actor.agencyId }, { parentAgencyId: actor.agencyId }],
    };
  }

  if (actor.role === AdminRoleName.CountryAdmin) {
    return actor.country ? { countryCode: actor.country } : { id: "__none__" };
  }

  if (actor.role === AdminRoleName.StateAdmin) {
    if (!actor.country || !actor.state) return { id: "__none__" };
    return { countryCode: actor.country, stateCode: actor.state };
  }

  if (actor.role === AdminRoleName.LgaAdmin) {
    if (!actor.country || !actor.state || !actor.lga) return { id: "__none__" };
    return { countryCode: actor.country, stateCode: actor.state, lgaCode: actor.lga };
  }

  // Other admin roles with agency:manage may list by geography if present
  if (actor.country) {
    const where: Record<string, unknown> = { countryCode: actor.country };
    if (actor.state) where.stateCode = actor.state;
    if (actor.lga) where.lgaCode = actor.lga;
    return where;
  }

  return { id: "__none__" };
}

export function throwAgencyScope(): never {
  throw new ForbiddenException({
    code: AGENCY_ERROR_CODES.OUTSIDE_JURISDICTION,
    message: "Agency is outside your jurisdiction scope",
  });
}
