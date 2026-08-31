import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { BRAND_ASSETS } from "../lib/brand";
import { filterNavItems } from "../lib/nav-access";
import type { AdminRole, AdminSession } from "../lib/types/admin-views";
import { roleScope } from "../lib/types/admin-views";
import { EnvironmentBadge } from "./environment-badge";
import { NavSection } from "./nav-section";
import { ShellNavLink } from "./shell-nav-link";
import { DirectionalScrollControl } from "./directional-scroll-control";

const navGroups = [
  {
    label: "Menu",
    items: [
      ["Dashboard", "/"],
      ["Reports", "/incidents"],
      ["Broadcast", "/broadcasts"],
      ["Users", "/users"],
    ] as [string, string][],
  },
  {
    label: "Reports",
    items: [
      ["Emergencies", "/emergency"],
      ["Command Center", "/dispatch"],
      ["Agency Dispatch", "/dispatch/agency"],
      ["Verification", "/verification"],
      ["Live Video", "/live-video"],
      ["SOS Monitor", "/sos-monitor"],
      ["Missing Persons", "/missing-persons"],
      ["Stolen Vehicles", "/stolen-vehicles"],
    ] as [string, string][],
  },
  {
    label: "Drone Surveillance",
    items: [["Drone Surveillance", "/drone-surveillance"]] as [string, string][],
  },
  {
    label: "Other Services",
    items: [
      ["Job Vacancies", "/job-vacancies"],
    ] as [string, string][],
  },
  {
    label: "Chats",
    items: [["Live Chats", "/live-chats"]] as [string, string][],
  },
  {
    label: "Neighborhood Watch",
    items: [
      ["Community Safety Dashboard", "/neighborhood-watch"],
      ["Communities", "/neighborhood-watch/communities"],
      ["Community Map", "/neighborhood-watch/map"],
      ["Verification", "/neighborhood-watch/verification"],
      ["Live Monitoring", "/neighborhood-watch/live-monitoring"],
    ] as [string, string][],
  },
  {
    label: "Devices",
    items: [
      ["Smart Watches", "/devices/smart-watches"],
      ["Field Tablets", "/field-operations/devices"],
      ["Create Field Device", "/field-operations/devices/new"],
      ["Permission Profiles", "/field-operations/permission-profiles"],
      ["Field Monitoring", "/field-operations/monitoring"],
    ] as [string, string][],
  },
  {
    label: "Safety Alerts",
    items: [["Danger Zones", "/safety-alerts"]] as [string, string][],
  },
  {
    label: "Administration",
    items: [
      ["Roles", "/roles"],
      ["Agencies", "/agencies"],
      ["Police Locator", "/police-stations"],
      ["Jurisdictions", "/jurisdictions"],
      ["Audit Logs", "/audit"],
      ["Analytics", "/analytics"],
      ["Notifications", "/notifications"],
    ] as [string, string][],
  },
];

export function AppShellFrame({
  children,
  session = null,
}: Readonly<{ children: ReactNode; session?: AdminSession | null }>) {
  const activeRole = (session?.role ?? "State Admin") as AdminRole;
  const scope = roleScope[activeRole] ?? "Signed in admin";
  const visibleGroups = navGroups
    .map((group) => ({ ...group, items: filterNavItems(activeRole, group.items) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen bg-field text-ink lg:grid lg:grid-cols-[280px_1fr]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-soft"
      >
        Skip to main content
      </a>
      <aside className="bg-command px-4 py-4 text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:px-5 lg:py-5" aria-label="Admin navigation">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/" className="block max-w-[180px]" aria-label="THE EYE home">
            <Image src={BRAND_ASSETS.lockupDarkBg} alt="The Eye" width={180} height={48} priority className="h-auto w-full" />
          </Link>
          <EnvironmentBadge />
        </div>
        <div className="mb-5 rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase text-white/50">Active role</p>
          <p className="mt-1 font-semibold">{activeRole}</p>
          <p className="mt-2 text-sm leading-5 text-white/60">{scope}</p>
          {session?.email ? <p className="mt-2 text-xs text-white/50">{session.email}</p> : null}
        </div>
        <nav className="grid gap-2" aria-label="Primary">
          {visibleGroups.map((group) => (
            <NavSection key={group.label} label={group.label}>
              {group.items.map(([label, href]) => (
                <ShellNavLink key={`${group.label}-${label}`} href={href} label={label} />
              ))}
            </NavSection>
          ))}
          <div className="border-t border-white/10 pt-2">
            {filterNavItems(activeRole, [["Settings", "/settings"]]).length ? <ShellNavLink href="/settings" label="Settings" /> : null}
            {session ? (
              <form action="/api/auth/logout" method="post" className="mt-1">
                <button type="submit" className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-red-400 transition-colors hover:bg-white/10">
                  Logout
                </button>
              </form>
            ) : (
              <ShellNavLink href="/login" label="Login" />
            )}
          </div>
        </nav>
      </aside>
      <main id="main-content" className="min-w-0 p-4 sm:p-6 lg:p-8 lg:pr-44 2xl:pr-8">
        {children}
      </main>
      <DirectionalScrollControl />
    </div>
  );
}
