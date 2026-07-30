"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items: [string, string][] = [
  ["Active Danger Zones", "/safety-alerts"],
  ["Pending Verification", "/safety-alerts/pending"],
  ["Geo-Zone Map", "/safety-alerts/map"],
  ["Alert History", "/safety-alerts/history"],
  ["All-Clear Queue", "/safety-alerts/all-clear"],
  ["Delivery Monitoring", "/safety-alerts/delivery"],
  ["Watch Analytics", "/safety-alerts/watch-analytics"],
];

export function SafetyAlertsSubnav() {
  const pathname = usePathname();
  return (
    <nav className="mb-5 flex flex-wrap gap-2 rounded-lg border border-line bg-surface p-2" aria-label="Safety alerts sections">
      {items.map(([label, href]) => {
        const active = pathname === href || (href !== "/safety-alerts" && pathname.startsWith(href));
        const listActive = href === "/safety-alerts" && pathname.startsWith("/safety-alerts/") && !items.some(([_, itemHref]) => itemHref !== href && pathname.startsWith(itemHref));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active || listActive ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${active || listActive ? "bg-eye/10 font-semibold text-eye" : "text-muted hover:bg-surfaceMuted hover:text-ink"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
