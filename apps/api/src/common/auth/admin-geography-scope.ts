import { AdminRoleName } from "@the-eye/shared";
import type { JwtPayload } from "./jwt";

export type GeographyScope = {
  country?: string;
  state?: string;
  lga?: string;
};

export function adminCanAccessGeography(
  geography: GeographyScope,
  actor: JwtPayload,
): boolean {
  if (actor.role === AdminRoleName.SuperAdmin) return true;
  if (actor.role === AdminRoleName.CountryAdmin) {
    return !geography.country || geography.country === actor.country;
  }
  if (actor.role === AdminRoleName.StateAdmin || actor.role === AdminRoleName.DroneCommander) {
    return (
      geography.country === actor.country &&
      (!geography.state || geography.state === actor.state)
    );
  }
  if (
    actor.role === AdminRoleName.LgaAdmin ||
    actor.role === AdminRoleName.CallCenterAgent ||
    actor.role === AdminRoleName.OversightAuditor ||
    actor.role === AdminRoleName.AgencyAdmin ||
    actor.role === AdminRoleName.PoliceSecurityOfficer ||
    actor.role === AdminRoleName.DroneOperator
  ) {
    return (
      geography.country === actor.country &&
      geography.state === actor.state &&
      (!geography.lga || geography.lga === actor.lga)
    );
  }
  return false;
}

export function adminGeographyWhere(actor: JwtPayload): GeographyScope | null {
  if (actor.role === AdminRoleName.SuperAdmin) return null;
  if (actor.role === AdminRoleName.CountryAdmin) {
    return actor.country ? { country: actor.country } : {};
  }
  if (actor.role === AdminRoleName.StateAdmin || actor.role === AdminRoleName.DroneCommander) {
    return actor.country && actor.state
      ? { country: actor.country, state: actor.state }
      : {};
  }
  if (
    actor.role === AdminRoleName.LgaAdmin ||
    actor.role === AdminRoleName.CallCenterAgent ||
    actor.role === AdminRoleName.OversightAuditor ||
    actor.role === AdminRoleName.AgencyAdmin ||
    actor.role === AdminRoleName.PoliceSecurityOfficer ||
    actor.role === AdminRoleName.DroneOperator
  ) {
    return actor.country && actor.state && actor.lga
      ? { country: actor.country, state: actor.state, lga: actor.lga }
      : {};
  }
  return {};
}
