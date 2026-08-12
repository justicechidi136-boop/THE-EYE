import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { MetricCard, PageHeader, Panel, StatusBadge } from "../../components/ui";
import {
  fetchAuditLogs,
  fetchBroadcasts,
  fetchIncidents,
  fetchUsersDirectory,
  fetchVerificationDashboard,
} from "../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [incidents, users, broadcasts, audit, verification] = await Promise.all([
    fetchIncidents(),
    fetchUsersDirectory(),
    fetchBroadcasts(),
    fetchAuditLogs(),
    fetchVerificationDashboard(),
  ]);

  const averageConfidence = incidents.length
    ? Math.round(incidents.reduce((sum, incident) => sum + incident.confidenceScore, 0) / incidents.length)
    : 0;
  const agencies = new Set(incidents.map((incident) => incident.assignedAgency).filter((agency) => agency && agency !== "Unassigned"));
  const typeCounts = incidents.reduce<Record<string, number>>((counts, incident) => {
    counts[incident.type] = (counts[incident.type] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <AppShell>
      <PageHeader eyebrow="Operational intelligence" title="Analytics dashboard" action={<StatusBadge tone="success">Live backend data</StatusBadge>} />
      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Average confidence" value={`${averageConfidence}%`} />
        <MetricCard label="Assigned agencies" value={String(agencies.size)} />
        <MetricCard label="Verification queue" value={String(verification.pending)} detail={`${verification.highConfidenceLast24h} high / ${verification.lowConfidenceLast24h} low (24h)`} />
        <MetricCard label="Registered users" value={String(users.length)} />
        <MetricCard label="P1/P2 load" value={String(incidents.filter((incident) => incident.priority === "P1" || incident.priority === "P2").length)} />
        <MetricCard label="Evidence files" value={String(incidents.reduce((sum, incident) => sum + incident.evidence.length, 0))} />
        <MetricCard label="Broadcasts" value={String(broadcasts.length)} />
        <MetricCard label="Audit events" value={String(audit.logs.length)} detail={audit.chainVerified ? "Chain verified" : "Chain unverified"} />
      </section>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Incident mix by type">
          <div className="grid gap-3">
            {Object.entries(typeCounts).length ? Object.entries(typeCounts).map(([type, count]) => (
              <div key={type} className="rounded-lg border border-line bg-surfaceMuted p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{type}</p>
                  <StatusBadge tone="info">{count}</StatusBadge>
                </div>
              </div>
            )) : <p className="text-sm text-muted">No incidents available for analytics in the current scope.</p>}
          </div>
        </Panel>
        <Panel title="Operational shortcuts">
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="/verification" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">Verification queue</Link>
            <Link href="/dispatch" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">Command center</Link>
            <Link href="/audit" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">Audit logs</Link>
            <Link href="/neighborhood-watch/analytics" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">Community analytics</Link>
          </div>
          <p className="mt-4 text-sm text-muted">
            Metrics aggregate live data from incidents, users, broadcasts, verification, and audit endpoints.
          </p>
        </Panel>
      </div>
    </AppShell>
  );
}
