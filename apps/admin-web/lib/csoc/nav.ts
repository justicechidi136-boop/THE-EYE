import { ADMIN_ROUTE_REGISTRY } from "../admin/admin-route-registry";

export type CsocNavItem = {
  label: string;
  href: string;
  shortcut?: string;
  routeId?: string;
};

/** CSOC-only and shared routes. Duplicated capabilities use canonical paths from the registry. */
const CSOC_ONLY_NAV: CsocNavItem[] = [
  { label: "Community Safety Dashboard", href: "/neighborhood-watch", shortcut: "g d" },
  { label: "Community Map", href: "/neighborhood-watch/map", shortcut: "g m" },
  { label: "Residents", href: "/neighborhood-watch/residents" },
  { label: "Community Feed", href: "/neighborhood-watch/posts" },
  { label: "Verification Queue", href: "/neighborhood-watch/verification" },
  { label: "Smartwatch Console", href: "/neighborhood-watch/smartwatch" },
  { label: "Live Monitoring", href: "/neighborhood-watch/live-monitoring" },
  { label: "AI Intelligence", href: "/neighborhood-watch/ai-intelligence" },
  { label: "Analytics", href: "/neighborhood-watch/analytics" },
  { label: "Reports", href: "/neighborhood-watch/reports" },
  { label: "Audit Logs", href: "/neighborhood-watch/audit" },
  { label: "Settings", href: "/neighborhood-watch/settings" },
];

const CSOC_REGISTRY_ORDER = [
  "community-registry",
  "membership-approval",
  "incident-centre",
  "broadcasts",
  "missing-persons",
  "stolen-vehicles",
  "patrol",
  "volunteers",
  "community-chat",
  "emergency-command",
] as const;

function registryNavItems(): CsocNavItem[] {
  return CSOC_REGISTRY_ORDER.flatMap((id) => {
    const route = ADMIN_ROUTE_REGISTRY.find((entry) => entry.id === id);
    if (!route || route.shell === "main") return [];
    return [{ label: route.label, href: route.canonicalPath, routeId: route.id }];
  });
}

export const CSOC_NAV_ITEMS: CsocNavItem[] = [
  CSOC_ONLY_NAV[0]!,
  CSOC_ONLY_NAV[1]!,
  ...registryNavItems().slice(0, 2),
  CSOC_ONLY_NAV[2]!,
  CSOC_ONLY_NAV[3]!,
  ...registryNavItems().slice(2, 3),
  CSOC_ONLY_NAV[4]!,
  ...registryNavItems().slice(3),
  ...CSOC_ONLY_NAV.slice(5),
];

export const CSOC_BASE = "/neighborhood-watch";
