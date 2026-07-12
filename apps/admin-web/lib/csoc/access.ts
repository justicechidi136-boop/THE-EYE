import { AdminRoleName } from "@the-eye/shared";
import type { AdminRole } from "../types/admin-views";
import { canAccessRoute } from "../nav-access";
import { CSOC_NAV_ITEMS, type CsocNavItem } from "./nav";

const CSOC_FULL_ACCESS: AdminRole[] = [
  AdminRoleName.SuperAdmin,
  AdminRoleName.CountryAdmin,
  AdminRoleName.StateAdmin,
  AdminRoleName.LgaAdmin,
  AdminRoleName.CommunityModerator,
];

const CSOC_READ_MONITOR: AdminRole[] = [
  AdminRoleName.AgencyAdmin,
  AdminRoleName.PoliceSecurityOfficer,
  AdminRoleName.CallCenterAgent,
  AdminRoleName.OversightAuditor,
];

const CSOC_RESTRICTED_PATHS: Partial<Record<AdminRole, string[]>> = {
  [AdminRoleName.OversightAuditor]: [
    "/neighborhood-watch",
    "/neighborhood-watch/audit",
    "/neighborhood-watch/analytics",
    "/neighborhood-watch/reports",
    "/neighborhood-watch/incidents",
    "/neighborhood-watch/verification",
    "/neighborhood-watch/posts",
  ],
  [AdminRoleName.CallCenterAgent]: [
    "/neighborhood-watch",
    "/neighborhood-watch/incidents",
    "/neighborhood-watch/verification",
    "/neighborhood-watch/live-monitoring",
    "/neighborhood-watch/broadcasts",
    "/neighborhood-watch/missing-persons",
    "/neighborhood-watch/smartwatch",
    "/neighborhood-watch/map",
  ],
  [AdminRoleName.PoliceSecurityOfficer]: [
    "/neighborhood-watch",
    "/neighborhood-watch/map",
    "/neighborhood-watch/incidents",
    "/neighborhood-watch/live-monitoring",
    "/neighborhood-watch/smartwatch",
    "/neighborhood-watch/patrols",
    "/neighborhood-watch/verification",
  ],
  [AdminRoleName.AgencyAdmin]: [
    "/neighborhood-watch",
    "/neighborhood-watch/map",
    "/neighborhood-watch/incidents",
    "/neighborhood-watch/verification",
    "/neighborhood-watch/live-monitoring",
  ],
};

export function canAccessCsocRoute(role: AdminRole, href: string): boolean {
  if (!canAccessRoute(role, href)) return false;
  if (CSOC_FULL_ACCESS.includes(role)) return true;
  if (!CSOC_READ_MONITOR.includes(role)) return false;
  const allowed = CSOC_RESTRICTED_PATHS[role];
  if (!allowed) return true;
  return allowed.some((prefix) => href === prefix || href.startsWith(`${prefix}/`));
}

export function filterCsocNavItems(role: AdminRole, items: CsocNavItem[] = CSOC_NAV_ITEMS): CsocNavItem[] {
  return items.filter((item) => canAccessCsocRoute(role, item.href));
}
