import { AdminRoleName } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { adminGeographyWhere, type GeographyScope } from "../../common/auth/admin-geography-scope";

export { adminGeographyWhere, type GeographyScope as WatchFleetGeography };

export function canViewWatchSensitiveFields(actor: JwtPayload): boolean {
  if (actor.typ !== "admin") return false;
  return (
    actor.role === AdminRoleName.SuperAdmin ||
    actor.role === AdminRoleName.CountryAdmin ||
    actor.role === AdminRoleName.StateAdmin ||
    actor.role === AdminRoleName.LgaAdmin ||
    actor.role === AdminRoleName.AgencyAdmin
  );
}

export function maskSensitiveField(value: string | null | undefined, permitted: boolean) {
  if (!value) return null;
  if (permitted) return value;
  if (value.length <= 4) return "***";
  return `${value.slice(0, 2)}…${value.slice(-2)}`;
}

export function maskImei(value: string | null | undefined, permitted: boolean) {
  if (!value) return null;
  if (permitted) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function organizationMatchesGeography(org: GeographyScope, scope: GeographyScope | null): boolean {
  if (!scope) return true;
  if (scope.country && org.country !== scope.country) return false;
  if (scope.state && org.state !== scope.state) return false;
  if (scope.lga && org.lga !== scope.lga) return false;
  return true;
}
