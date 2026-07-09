import Link from "next/link";
import type { ReactNode } from "react";
import { currentRole, roleScope } from "../lib/mock-data";

const navGroups = [
  {
    label: "Operations",
    items: [
      ["Command", "/"],
      ["Incidents", "/incidents"],
      ["Verification", "/verification"],
      ["Emergency Queue", "/emergency"],
      ["Live Video", "/live-video"],
      ["SOS Monitor", "/sos-monitor"],
    ],
  },
  {
    label: "Public Alerts",
    items: [
      ["Broadcasts", "/broadcasts"],
      ["Notifications", "/notifications"],
      ["Missing Persons", "/missing-persons"],
      ["Stolen Vehicles", "/stolen-vehicles"],
    ],
  },
  {
    label: "Neighborhood Watch",
    items: [
      ["Communities", "/neighborhood-watch"],
      ["Posts", "/neighborhood-watch/posts"],
      ["Approvals", "/neighborhood-watch/approvals"],
      ["Verification", "/neighborhood-watch/verification"],
      ["Volunteers", "/neighborhood-watch/volunteers"],
      ["Patrols", "/neighborhood-watch/patrols"],
      ["Map", "/neighborhood-watch/map"],
      ["Analytics", "/neighborhood-watch/analytics"],
    ],
  },
  {
    label: "Smartwatch",
    items: [
      ["All Watches", "/smartwatch"],
      ["Firmware", "/smartwatch/firmware"],
      ["Live Tracking", "/smartwatch/live-tracking"],
      ["Device Health", "/smartwatch/health"],
    ],
  },
  {
    label: "Administration",
    items: [
      ["Users", "/users"],
      ["Roles", "/roles"],
      ["Agencies", "/agencies"],
      ["Police Locator", "/police-stations"],
      ["Jurisdictions", "/jurisdictions"],
      ["Audit Logs", "/audit"],
      ["Analytics", "/analytics"],
    ],
  },
];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="min-h-screen bg-field text-ink lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="bg-command px-4 py-4 text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:px-5 lg:py-5">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/" className="text-2xl font-black tracking-normal">THE EYE</Link>
          <Link href="/login" className="rounded-md border border-white/20 px-3 py-2 text-sm text-white/80">Login</Link>
        </div>
        <div className="mb-5 rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase text-white/50">Active role</p>
          <p className="mt-1 font-semibold">{currentRole}</p>
          <p className="mt-2 text-sm leading-5 text-white/60">{roleScope[currentRole]}</p>
        </div>
        <nav className="grid gap-2">
          {navGroups.map((group, index) => (
            <details key={group.label} className="group border-t border-white/10 pt-2" open={index === 0}>
              <summary className="cursor-pointer list-none rounded-md px-3 py-2 text-xs font-bold uppercase text-white/50 hover:bg-white/5 hover:text-white">
                {group.label}
              </summary>
              <div className="mt-1 grid gap-1">
                {group.items.map(([label, href]) => (
                  <Link key={href} href={href} className="rounded-md px-3 py-2 text-sm text-white/75 hover:bg-white/10 hover:text-white">
                    {label}
                  </Link>
                ))}
              </div>
            </details>
          ))}
        </nav>
      </aside>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</section>
    </main>
  );
}
