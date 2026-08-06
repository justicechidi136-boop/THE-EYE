import { AdminRoleName } from "@the-eye/shared";
import type { AdminSession } from "./types/admin-views";

const MANAGE_ROLES = new Set<string>([
  AdminRoleName.SuperAdmin,
  AdminRoleName.CountryAdmin,
  AdminRoleName.StateAdmin,
  AdminRoleName.LgaAdmin,
  AdminRoleName.AgencyAdmin,
]);

export function canManageFieldDevices(session: AdminSession | null): boolean {
  if (!session?.role) return false;
  return MANAGE_ROLES.has(session.role);
}
