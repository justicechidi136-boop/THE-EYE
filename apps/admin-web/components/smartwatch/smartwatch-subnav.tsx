"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const allItems: [string, string, "manage" | "any"][] = [
  ["Smart Watches", "/devices/smart-watches", "any"],
  ["Pending Activations", "/devices/smart-watches/pending-activations", "manage"],
  ["Firmware Management", "/devices/smart-watches/firmware", "manage"],
  ["SOS History", "/devices/smart-watches/sos-history", "any"],
  ["Device Health", "/devices/smart-watches/health", "any"],
  ["Live Tracking", "/devices/smart-watches/live-tracking", "any"],
];

function SubnavLink({ href, label, items }: { href: string; label: string; items: [string, string][] }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/devices/smart-watches" && pathname.startsWith(`${href}/`)) || (href === "/devices/smart-watches" && pathname.startsWith("/devices/smart-watches/") && !items.some(([_, itemHref]) => itemHref !== href && pathname.startsWith(itemHref)));

  const isListActive = href === "/devices/smart-watches" && (pathname === href || pathname.match(/^\/devices\/smart-watches\/[^/]+$/));

  return (
    <Link
      href={href}
      aria-current={active || isListActive ? "page" : undefined}
      className={`rounded-md px-3 py-2 text-sm transition-colors ${
        active || isListActive ? "bg-eye/10 font-semibold text-eye" : "text-muted hover:bg-surfaceMuted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

export function SmartwatchSubnav({ canManage = false }: { canManage?: boolean }) {
  const items = allItems
    .filter(([, , scope]) => scope === "any" || canManage)
    .map(([label, href]) => [label, href] as [string, string]);

  return (
    <nav className="mb-5 flex flex-wrap gap-2 rounded-lg border border-line bg-surface p-2" aria-label="Smartwatch sections">
      {items.map(([label, href]) => (
        <SubnavLink key={href} href={href} label={label} items={items} />
      ))}
    </nav>
  );
}
