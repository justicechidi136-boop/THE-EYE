import Link from "next/link";
import { AppShell } from "../components/app-shell";
import { DashboardActivityFeeds, DashboardChart } from "../components/dashboard-widgets";
import { QuickLinkCard } from "../components/quick-link-card";
import { MetricCard, PageHeader, Panel, StatusBadge } from "../components/ui";
import { filterNavItems } from "../lib/nav-access";
import { fetchBroadcasts, fetchIncidents, fetchLiveVideoSessions, fetchUsersDirectory } from "../lib/api/data";
import { buildDashboardChart } from "../lib/dashboard-metrics";
import { getAdminSession } from "../lib/session";
import { roleScope } from "../lib/types/admin-views";
import type { AdminRole } from "../lib/types/admin-views";

export const dynamic = "force-dynamic";

const QUICK_LINKS: [string, string, string][] = [
  ["Emergency command center", "/dispatch", "Unassigned incidents and live coordinates"],
  ["Verification queue", "/verification", "Confidence scoring and crowd confirmation"],
  ["Community chat", "/neighborhood-watch/chat", "Moderated community channels"],
  ["Settings", "/settings", "Profile, security, and display preferences"],
];

export default async function DashboardPage() {
  const session = await getAdminSession();
  const activeRole = (session?.role ?? "State Admin") as AdminRole;
  const quickLinks = filterNavItems(activeRole, QUICK_LINKS.map(([title, href]) => [title, href] as [string, string])).map(
    ([title, href]) => {
      const meta = QUICK_LINKS.find(([t, h]) => t === title && h === href);
      return { title, href, description: meta?.[2] ?? "" };
    },
  );
  const initials = session?.email?.slice(0, 2).toUpperCase() ?? "AD";
  const [incidents, broadcasts, users, liveSessions] = await Promise.all([
    fetchIncidents(),
    fetchBroadcasts(),
    fetchUsersDirectory(),
    fetchLiveVideoSessions(),
  ]);
  const chart = buildDashboardChart(incidents, users.length, liveSessions);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Command dashboard"
        title="Dashboard"
        action={
          <div className="flex items-center gap-3">
            <StatusBadge tone="info">Notifications</StatusBadge>
            <Link href="/notifications" className="text-sm font-semibold text-eye hover:underline">Open inbox →</Link>
            <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-eye text-sm font-bold text-white">{initials}</span>
              <div>
                <p className="text-sm font-semibold">{session?.email?.split("@")[0] ?? "Administrator"}</p>
                <p className="text-xs text-muted">{activeRole}</p>
              </div>
            </div>
          </div>
        }
      />

      <section className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard label="Total Users" value={String(users.length)} detail="Registered citizens and admins" accent="eyeOrange" />
        <MetricCard label="Total Report" value={String(incidents.length)} detail="Incidents in assigned scope" accent="eye" />
        <MetricCard label="Total Live Videos" value={String(liveSessions.length)} detail="Active and recent sessions" accent="ink" />
      </section>

      {quickLinks.length ? (
        <section className="mb-5">
          <Panel title="Quick access">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {quickLinks.map((link) => (
                <QuickLinkCard key={link.href} href={link.href} title={link.title} description={link.description} />
              ))}
            </div>
          </Panel>
        </section>
      ) : null}

      <section className="mb-5">
        <DashboardChart chartData={chart.points} footnote={chart.footnote} />
      </section>

      <section className="mb-5">
        <DashboardActivityFeeds incidents={incidents} />
      </section>

      <p className="text-xs text-muted">
        Scope: {roleScope[activeRole as keyof typeof roleScope] ?? "Admin scope"} — {broadcasts.length} broadcasts in queue.
      </p>
    </AppShell>
  );
}
