import { AppShell } from "../components/app-shell";
import { DashboardActivityFeeds, DashboardChart } from "../components/dashboard-widgets";
import { MetricCard, PageHeader, StatusBadge } from "../components/ui";
import { fetchBroadcasts, fetchIncidents, fetchLiveVideoSessions, fetchUsersDirectory } from "../lib/api/data";
import { buildDashboardChart } from "../lib/dashboard-metrics";
import { getAdminSession } from "../lib/session";
import { roleScope } from "../lib/types/admin-views";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [session, incidents, broadcasts, users, liveSessions] = await Promise.all([
    getAdminSession(),
    fetchIncidents(),
    fetchBroadcasts(),
    fetchUsersDirectory(),
    fetchLiveVideoSessions(),
  ]);
  const activeRole = session?.role ?? "State Admin";
  const initials = session?.email?.slice(0, 2).toUpperCase() ?? "AD";
  const chart = buildDashboardChart(incidents, users.length, liveSessions);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Command dashboard"
        title="Dashboard"
        action={
          <div className="flex items-center gap-3">
            <StatusBadge tone="info">Notifications</StatusBadge>
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
