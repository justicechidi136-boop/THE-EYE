export type CsocNavItem = {
  label: string;
  href: string;
  shortcut?: string;
};

export const CSOC_NAV_ITEMS: CsocNavItem[] = [
  { label: "Dashboard", href: "/neighborhood-watch", shortcut: "g d" },
  { label: "Community Map", href: "/neighborhood-watch/map", shortcut: "g m" },
  { label: "Communities", href: "/neighborhood-watch/communities" },
  { label: "Residents", href: "/neighborhood-watch/residents" },
  { label: "Community Feed", href: "/neighborhood-watch/posts" },
  { label: "Incident Centre", href: "/neighborhood-watch/incidents" },
  { label: "Verification Queue", href: "/neighborhood-watch/verification" },
  { label: "Emergency Broadcasts", href: "/neighborhood-watch/broadcasts" },
  { label: "Missing Persons", href: "/neighborhood-watch/missing-persons" },
  { label: "Stolen Vehicles", href: "/neighborhood-watch/stolen-vehicles" },
  { label: "Patrol Management", href: "/neighborhood-watch/patrols" },
  { label: "Volunteer Network", href: "/neighborhood-watch/volunteers" },
  { label: "Community Chat", href: "/neighborhood-watch/chat" },
  { label: "Smartwatch Console", href: "/neighborhood-watch/smartwatch" },
  { label: "Live Monitoring", href: "/neighborhood-watch/live-monitoring" },
  { label: "AI Intelligence", href: "/neighborhood-watch/ai-intelligence" },
  { label: "Analytics", href: "/neighborhood-watch/analytics" },
  { label: "Reports", href: "/neighborhood-watch/reports" },
  { label: "Audit Logs", href: "/neighborhood-watch/audit" },
  { label: "Settings", href: "/neighborhood-watch/settings" },
];

export const CSOC_BASE = "/neighborhood-watch";
