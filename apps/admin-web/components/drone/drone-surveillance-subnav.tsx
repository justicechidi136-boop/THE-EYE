"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Scope = "any" | "manage" | "command";

const allItems: [string, string, Scope][] = [
  ["Overview", "/drone-surveillance", "any"],
  ["Active Missions", "/drone-surveillance/missions", "any"],
  ["Live GPS Map", "/drone-surveillance/map", "any"],
  ["Live Video", "/drone-surveillance/live-video", "any"],
  ["Fleet", "/drone-surveillance/fleet", "manage"],
  ["Scheduling", "/drone-surveillance/scheduling", "command"],
  ["Flight History", "/drone-surveillance/flight-history", "any"],
  ["Incident Missions", "/drone-surveillance/incidents", "any"],
  ["Operators", "/drone-surveillance/operators", "manage"],
  ["Health", "/drone-surveillance/health", "any"],
  ["Evidence", "/drone-surveillance/evidence", "any"],
  ["Flight Logs", "/drone-surveillance/flight-logs", "any"],
  ["Geofences", "/drone-surveillance/geofences", "manage"],
  ["No-Fly Zones", "/drone-surveillance/no-fly-zones", "manage"],
];

function SubnavLink({ href, label, items }: { href: string; label: string; items: [string, string][] }) {
  const pathname = usePathname();
  const active =
    pathname === href ||
    (href !== "/drone-surveillance" && pathname.startsWith(`${href}/`)) ||
    (href === "/drone-surveillance" && pathname === "/drone-surveillance");

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-3 py-2 text-sm transition-colors ${
        active ? "bg-eye/10 font-semibold text-eye" : "text-muted hover:bg-surfaceMuted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

export function DroneSurveillanceSubnav({
  canManage = false,
  canCommand = false,
}: {
  canManage?: boolean;
  canCommand?: boolean;
}) {
  const items = allItems
    .filter(([, , scope]) => {
      if (scope === "any") return true;
      if (scope === "manage") return canManage;
      return canCommand;
    })
    .map(([label, href]) => [label, href] as [string, string]);

  return (
    <nav className="mb-5 flex flex-wrap gap-2 rounded-lg border border-line bg-surface p-2" aria-label="Drone surveillance sections">
      {items.map(([label, href]) => (
        <SubnavLink key={href} href={href} label={label} items={items} />
      ))}
    </nav>
  );
}
