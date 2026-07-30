import Link from "next/link";
import { CsocActivityTimeline } from "../../components/csoc/csoc-activity-timeline";
import { CsocMap } from "../../components/csoc/csoc-map";
import { CsocMetricGrid } from "../../components/csoc/csoc-metric-grid";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { fetchCsocMapMarkers } from "../../lib/api/data";
import { fetchCsocDashboardMetrics } from "../../lib/csoc/metrics";

export const dynamic = "force-dynamic";

export default async function CsocDashboardPage() {
  const [metrics, mapMarkers] = await Promise.all([fetchCsocDashboardMetrics(), fetchCsocMapMarkers()]);

  return (
    <>
      <PageHeader
        eyebrow="Community Security Operations Center"
        title="Dashboard"
        action={<StatusBadge tone="success">Safety score {metrics.safetyScore}%</StatusBadge>}
      />
      <CsocMetricGrid
        metrics={[
          { label: "Community Safety Score", value: `${metrics.safetyScore}%`, accent: "eye", href: "/neighborhood-watch/analytics" },
          { label: "Communities Online", value: String(metrics.communitiesOnline), href: "/neighborhood-watch/communities" },
          { label: "Residents Online", value: String(metrics.residentsOnline), href: "/neighborhood-watch/residents" },
          { label: "Pending Verifications", value: String(metrics.pendingVerifications), accent: "eyeOrange", href: "/neighborhood-watch/verification" },
          { label: "Live Incidents", value: String(metrics.liveIncidents), accent: "eyeOrange", href: "/dispatch" },
          { label: "Active Broadcasts", value: String(metrics.activeBroadcasts), href: "/neighborhood-watch/broadcasts" },
          { label: "Missing Persons", value: String(metrics.missingPersons), href: "/neighborhood-watch/missing-persons" },
          { label: "Wanted Persons", value: String(metrics.wantedPersons), href: "/neighborhood-watch/incidents" },
          { label: "Stolen Vehicles", value: String(metrics.stolenVehicles), href: "/neighborhood-watch/stolen-vehicles" },
          { label: "Volunteers Available", value: String(metrics.volunteersAvailable), accent: "eye", href: "/neighborhood-watch/volunteers" },
          { label: "Patrols Active", value: String(metrics.patrolsActive), href: "/neighborhood-watch/patrols" },
          { label: "Avg Response Time", value: metrics.avgResponseMinutes ? `${metrics.avgResponseMinutes}m` : "—", href: "/neighborhood-watch/analytics" },
          { label: "False Report Rate", value: `${metrics.falseReportRate}%`, href: "/neighborhood-watch/reports" },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <CsocMap markers={mapMarkers.slice(0, 40)} title="Heat map preview" heightClass="min-h-[360px]" />
        <CsocActivityTimeline entries={metrics.recentActivity} />
      </div>
      <Panel title="Quick links" aside={<Link href="/neighborhood-watch/incidents" className="text-sm font-semibold text-eye hover:underline">Incident Centre →</Link>}>
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Link href="/neighborhood-watch/verification" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 transition-colors hover:border-eye">Verification Queue</Link>
          <Link href="/dispatch" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 transition-colors hover:border-eye">Emergency Command Center</Link>
          <Link href="/neighborhood-watch/chat" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 transition-colors hover:border-eye">Community Chat</Link>
          <Link href="/neighborhood-watch/settings" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 transition-colors hover:border-eye">Settings</Link>
          <Link href="/neighborhood-watch/broadcasts" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 transition-colors hover:border-eye">Emergency Broadcasts</Link>
          <Link href="/neighborhood-watch/live-monitoring" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 transition-colors hover:border-eye">Live Monitoring</Link>
          <Link href="/neighborhood-watch/smartwatch" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 transition-colors hover:border-eye">Smartwatch Console</Link>
        </div>
      </Panel>
    </>
  );
}
