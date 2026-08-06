import { AdminRoleName } from "@the-eye/shared";
import type { AdminRole } from "../types/admin-views";

export type AdminShell = "main" | "csoc" | "both";

export type AdminRouteDefinition = {
  id: string;
  canonicalPath: string;
  legacyPaths?: string[];
  label: string;
  pageHeading: string;
  shell: AdminShell;
  navGroup?: string;
  module: string;
  permissions: string[];
  allowedRoles?: AdminRole[];
  icon?: string;
  breadcrumb?: string[];
};

export const ADMIN_ROUTE_REGISTRY: AdminRouteDefinition[] = [
  {
    id: "incident-centre",
    canonicalPath: "/incidents",
    legacyPaths: ["/neighborhood-watch/incidents"],
    label: "Incident Centre",
    pageHeading: "Incident Centre",
    shell: "both",
    navGroup: "Operations",
    module: "incidents",
    permissions: ["incident:read"],
    breadcrumb: ["Operations", "Incident Centre"],
  },
  {
    id: "live-chat",
    canonicalPath: "/live-chats",
    label: "Live Chat",
    pageHeading: "Live operational chat",
    shell: "main",
    navGroup: "Chats",
    module: "support-chats",
    permissions: ["incident:read", "incident:update"],
    breadcrumb: ["Chats", "Live Chat"],
  },
  {
    id: "community-chat",
    canonicalPath: "/neighborhood-watch/chat",
    label: "Community Chat",
    pageHeading: "Community chat moderation",
    shell: "csoc",
    navGroup: "Community",
    module: "neighborhood-watch",
    permissions: ["community:moderate", "community:read"],
    breadcrumb: ["Community", "Chat"],
  },
  {
    id: "agency-dispatch",
    canonicalPath: "/dispatch/agency",
    label: "Agency Dispatch",
    pageHeading: "Agency dispatch console",
    shell: "main",
    navGroup: "Reports",
    module: "dispatch",
    permissions: ["incident:assign", "incident:read"],
    breadcrumb: ["Dispatch", "Agency"],
  },
  {
    id: "emergency-command",
    canonicalPath: "/dispatch",
    label: "Emergency Command Center",
    pageHeading: "Emergency command center",
    shell: "both",
    navGroup: "Operations",
    module: "dispatch",
    permissions: ["incident:read", "incident:assign"],
    breadcrumb: ["Dispatch", "Command Center"],
  },
  {
    id: "missing-persons",
    canonicalPath: "/missing-persons",
    legacyPaths: ["/neighborhood-watch/missing-persons"],
    label: "Missing Persons",
    pageHeading: "Missing person management",
    shell: "both",
    navGroup: "Cases",
    module: "missing-persons",
    permissions: ["incident:read"],
    breadcrumb: ["Cases", "Missing Persons"],
  },
  {
    id: "stolen-vehicles",
    canonicalPath: "/stolen-vehicles",
    legacyPaths: ["/neighborhood-watch/stolen-vehicles"],
    label: "Stolen Vehicles",
    pageHeading: "Stolen vehicle management",
    shell: "both",
    navGroup: "Cases",
    module: "stolen-vehicles",
    permissions: ["incident:read"],
    breadcrumb: ["Cases", "Stolen Vehicles"],
  },
  {
    id: "broadcast-reports",
    canonicalPath: "/broadcasts/reports",
    label: "Broadcast Reports",
    pageHeading: "Broadcast reports",
    shell: "both",
    module: "broadcasts",
    permissions: ["broadcast:create", "broadcast:publish"],
    breadcrumb: ["Communications", "Broadcasts", "Reports"],
  },
  {
    id: "broadcast-analytics",
    canonicalPath: "/broadcasts/analytics",
    label: "Broadcast Analytics",
    pageHeading: "Broadcast analytics",
    shell: "both",
    module: "broadcasts",
    permissions: ["broadcast:create", "broadcast:publish"],
    breadcrumb: ["Communications", "Broadcasts", "Analytics"],
  },
  {
    id: "broadcasts",
    canonicalPath: "/broadcasts",
    legacyPaths: ["/neighborhood-watch/broadcasts"],
    label: "Emergency Broadcasts",
    pageHeading: "Emergency broadcasts",
    shell: "both",
    navGroup: "Communications",
    module: "broadcasts",
    permissions: ["broadcast:create", "broadcast:publish", "broadcast:approve"],
    breadcrumb: ["Communications", "Broadcasts"],
  },
  {
    id: "community-registry",
    canonicalPath: "/neighborhood-watch/communities",
    label: "Communities",
    pageHeading: "Community registry",
    shell: "csoc",
    navGroup: "Community",
    module: "neighborhood-watch",
    permissions: ["community:read", "community:moderate"],
    breadcrumb: ["Community", "Registry"],
  },
  {
    id: "membership-approval",
    canonicalPath: "/neighborhood-watch/approvals",
    label: "Resident Approvals",
    pageHeading: "Membership approval",
    shell: "csoc",
    navGroup: "Community",
    module: "neighborhood-watch",
    permissions: ["community:moderate", "community:verify"],
    breadcrumb: ["Community", "Approvals"],
  },
  {
    id: "patrol",
    canonicalPath: "/neighborhood-watch/patrols",
    label: "Patrol Management",
    pageHeading: "Patrol management",
    shell: "csoc",
    navGroup: "Community",
    module: "neighborhood-watch",
    permissions: ["community:patrol"],
    breadcrumb: ["Community", "Patrols"],
  },
  {
    id: "volunteers",
    canonicalPath: "/neighborhood-watch/volunteers",
    label: "Volunteer Network",
    pageHeading: "Volunteer network",
    shell: "csoc",
    navGroup: "Community",
    module: "neighborhood-watch",
    permissions: ["community:volunteer", "community:read"],
    breadcrumb: ["Community", "Volunteers"],
  },
  {
    id: "users",
    canonicalPath: "/users",
    label: "Users",
    pageHeading: "User management",
    shell: "main",
    navGroup: "Menu",
    module: "users",
    permissions: ["user:manage"],
    allowedRoles: [
      AdminRoleName.SuperAdmin,
      AdminRoleName.CountryAdmin,
      AdminRoleName.StateAdmin,
      AdminRoleName.LgaAdmin,
    ],
    breadcrumb: ["Administration", "Users"],
  },
];

export function getRouteById(id: string) {
  return ADMIN_ROUTE_REGISTRY.find((route) => route.id === id);
}

export function getRouteByPath(path: string) {
  const normalized = path.split("?")[0] ?? path;
  return ADMIN_ROUTE_REGISTRY.find(
    (route) =>
      route.canonicalPath === normalized ||
      route.legacyPaths?.includes(normalized) ||
      normalized.startsWith(`${route.canonicalPath}/`),
  );
}

export function resolveCanonicalPath(path: string): string {
  const normalized = path.split("?")[0] ?? path;
  for (const route of ADMIN_ROUTE_REGISTRY) {
    if (route.legacyPaths?.includes(normalized)) return route.canonicalPath;
  }
  return normalized;
}

export function isLegacyPath(path: string): boolean {
  const normalized = path.split("?")[0] ?? path;
  return ADMIN_ROUTE_REGISTRY.some((route) => route.legacyPaths?.includes(normalized));
}

export function mainNavGroups(): Array<{ label: string; items: Array<{ label: string; href: string; routeId: string }> }> {
  const groups = new Map<string, Array<{ label: string; href: string; routeId: string }>>();
  for (const route of ADMIN_ROUTE_REGISTRY) {
    if (route.shell === "csoc") continue;
    const group = route.navGroup ?? "Other";
    const items = groups.get(group) ?? [];
    items.push({ label: route.label, href: route.canonicalPath, routeId: route.id });
    groups.set(group, items);
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}

export function csocNavItems(): Array<{ label: string; href: string; routeId: string }> {
  return ADMIN_ROUTE_REGISTRY.filter((route) => route.shell === "csoc" || route.shell === "both").map((route) => ({
    label: route.label,
    href: route.canonicalPath,
    routeId: route.id,
  }));
}

/** Live Chat must never resolve to Community Chat */
export function liveChatPathsConflict(path: string): boolean {
  const canonical = resolveCanonicalPath(path);
  const live = getRouteById("live-chat");
  const community = getRouteById("community-chat");
  return canonical === live?.canonicalPath && path.startsWith(community?.canonicalPath ?? "__none__");
}

export function routeRequiresPermission(route: AdminRouteDefinition, permissions: string[]): boolean {
  if (!route.permissions.length) return true;
  return route.permissions.some((perm) => permissions.includes(perm));
}

export function routeAllowedForRole(route: AdminRouteDefinition, role: AdminRole): boolean {
  if (route.allowedRoles?.length) return route.allowedRoles.includes(role);
  return true;
}
