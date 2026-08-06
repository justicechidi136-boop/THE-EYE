import { AdminRoleName } from "@the-eye/shared";
import type { AdminRole } from "./types/admin-views";

const unrestricted: AdminRole[] = [AdminRoleName.SuperAdmin, AdminRoleName.CountryAdmin, AdminRoleName.StateAdmin];

const roleAllowedPrefixes: Partial<Record<AdminRole, string[]>> = {
  [AdminRoleName.LgaAdmin]: [
    "/",
    "/incidents",
    "/verification",
    "/emergency",
    "/dispatch",
    "/broadcasts",
    "/notifications",
    "/neighborhood-watch",
    "/live-chats",
    "/live-video",
    "/sos-monitor",
    "/missing-persons",
    "/stolen-vehicles",
    "/users",
    "/settings",
    "/login",
    "/audit",
    "/safety-alerts",
    "/devices",
    "/smartwatch",
    "/field-operations",
  ],
  [AdminRoleName.AgencyAdmin]: [
    "/",
    "/incidents",
    "/verification",
    "/emergency",
    "/dispatch",
    "/live-video",
    "/sos-monitor",
    "/devices",
    "/smartwatch",
    "/field-operations",
    "/safety-alerts",
    "/neighborhood-watch",
    "/live-chats",
    "/settings",
  ],
  [AdminRoleName.PoliceSecurityOfficer]: [
    "/",
    "/incidents",
    "/emergency",
    "/dispatch",
    "/live-video",
    "/sos-monitor",
    "/devices",
    "/smartwatch",
    "/safety-alerts",
    "/neighborhood-watch",
    "/live-chats",
    "/settings",
  ],
  [AdminRoleName.CallCenterAgent]: [
    "/",
    "/incidents",
    "/verification",
    "/emergency",
    "/dispatch",
    "/live-video",
    "/notifications",
    "/neighborhood-watch",
    "/live-chats",
    "/settings",
  ],
  [AdminRoleName.CommunityModerator]: ["/", "/neighborhood-watch", "/live-chats", "/settings"],
  [AdminRoleName.OversightAuditor]: ["/", "/incidents", "/audit", "/neighborhood-watch", "/drone-surveillance", "/settings"],
  [AdminRoleName.DroneCommander]: ["/", "/drone-surveillance", "/incidents", "/live-video", "/dispatch", "/settings"],
  [AdminRoleName.DroneOperator]: ["/", "/drone-surveillance", "/incidents", "/live-video", "/settings"],
  [AdminRoleName.ReadOnlyObserver]: ["/", "/drone-surveillance", "/incidents", "/audit", "/settings"],
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
