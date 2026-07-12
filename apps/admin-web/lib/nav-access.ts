import { AdminRoleName } from "@the-eye/shared";
import type { AdminRole } from "./types/admin-views";

const unrestricted: AdminRole[] = [AdminRoleName.SuperAdmin, AdminRoleName.CountryAdmin, AdminRoleName.StateAdmin];

const roleAllowedPrefixes: Partial<Record<AdminRole, string[]>> = {
  [AdminRoleName.LgaAdmin]: ["/", "/incidents", "/verification", "/emergency", "/broadcasts", "/notifications", "/neighborhood-watch", "/users", "/settings", "/login", "/audit"],
  [AdminRoleName.AgencyAdmin]: ["/", "/incidents", "/verification", "/emergency", "/live-video", "/sos-monitor", "/smartwatch", "/settings"],
  [AdminRoleName.PoliceSecurityOfficer]: ["/", "/incidents", "/emergency", "/live-video", "/sos-monitor", "/smartwatch", "/settings"],
  [AdminRoleName.CallCenterAgent]: ["/", "/incidents", "/verification", "/emergency", "/live-video", "/notifications", "/settings"],
  [AdminRoleName.CommunityModerator]: ["/neighborhood-watch", "/settings"],
  [AdminRoleName.OversightAuditor]: ["/", "/incidents", "/audit", "/settings"],
};

export function canAccessRoute(role: AdminRole, href: string): boolean {
  if (unrestricted.includes(role)) return true;
  const allowed = roleAllowedPrefixes[role];
  if (!allowed) return true;
  return allowed.some((prefix) => href === prefix || href.startsWith(`${prefix}/`));
}

export function filterNavItems(role: AdminRole, items: [string, string][]): [string, string][] {
  return items.filter(([, href]) => canAccessRoute(role, href));
}
