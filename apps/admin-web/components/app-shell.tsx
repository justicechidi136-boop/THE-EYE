import Link from "next/link";
import type { ReactNode } from "react";
import { currentRole, roleScope } from "../lib/mock-data";

const navItems = [
  ["Command", "/"],
  ["Incidents", "/incidents"],
  ["Verification", "/verification"],
  ["Emergency Queue", "/emergency"],
  ["Broadcasts", "/broadcasts"],
  ["Notifications", "/notifications"],
  ["Neighborhood Watch", "/neighborhood-watch"],
  ["NW Approvals", "/neighborhood-watch/approvals"],
  ["NW Verification", "/neighborhood-watch/verification"],
  ["NW Volunteers", "/neighborhood-watch/volunteers"],
  ["NW Patrols", "/neighborhood-watch/patrols"],
  ["NW Map", "/neighborhood-watch/map"],
  ["NW Analytics", "/neighborhood-watch/analytics"],
  ["Missing Persons", "/missing-persons"],
  ["Stolen Vehicles", "/stolen-vehicles"],
  ["Live Video", "/live-video"],
  ["SOS Monitor", "/sos-monitor"],
  ["Watch Management", "/smartwatch"],
  ["Watch Firmware", "/smartwatch/firmware"],
  ["Watch Tracking", "/smartwatch/live-tracking"],
  ["Watch Health", "/smartwatch/health"],
  ["Users", "/users"],
  ["Roles", "/roles"],
  ["Agencies", "/agencies"],
  ["Police Locator", "/police-stations"],
  ["Jurisdictions", "/jurisdictions"],
  ["Audit Logs", "/audit"],
  ["Analytics", "/analytics"],
];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="min-h-screen bg-field text-ink lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="bg-command px-5 py-5 text-white lg:min-h-screen">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/" className="text-2xl font-black tracking-normal">THE EYE</Link>
          <Link href="/login" className="rounded-md border border-white/20 px-3 py-2 text-sm text-white/80">Login</Link>
        </div>
        <div className="mb-5 rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase text-white/50">Active role</p>
          <p className="mt-1 font-semibold">{currentRole}</p>
          <p className="mt-2 text-sm leading-5 text-white/60">{roleScope[currentRole]}</p>
        </div>
        <nav className="grid gap-1">
          {navItems.map(([label, href]) => (
            <Link key={href} href={href} className="rounded-md px-3 py-2 text-sm text-white/75 hover:bg-white/10 hover:text-white">
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</section>
    </main>
  );
}
