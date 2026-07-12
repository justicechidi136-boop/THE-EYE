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
          { label: "Community Safety Score", value: `${metrics.safetyScore}%`, accent: "eye" },
          { label: "Communities Online", value: String(metrics.communitiesOnline) },
          { label: "Residents Online", value: String(metrics.residentsOnline) },
          { label: "Pending Verifications", value: String(metrics.pendingVerifications), accent: "eyeOrange" },
          { label: "Live Incidents", value: String(metrics.liveIncidents), accent: "eyeOrange" },
          { label: "Active Broadcasts", value: String(metrics.activeBroadcasts) },
          { label: "Missing Persons", value: String(metrics.missingPersons) },
          { label: "Wanted Persons", value: String(metrics.wantedPersons) },
          { label: "Stolen Vehicles", value: String(metrics.stolenVehicles) },
          { label: "Volunteers Available", value: String(metrics.volunteersAvailable), accent: "eye" },
          { label: "Patrols Active", value: String(metrics.patrolsActive) },
          { label: "Avg Response Time", value: metrics.avgResponseMinutes ? `${metrics.avgResponseMinutes}m` : "—" },
          { label: "False Report Rate", value: `${metrics.falseReportRate}%` },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <CsocMap markers={mapMarkers.slice(0, 40)} title="Heat map preview" heightClass="min-h-[360px]" />
        <CsocActivityTimeline entries={metrics.recentActivity} />
      </div>
      <Panel title="Quick links" aside={<Link href="/neighborhood-watch/incidents" className="text-sm font-semibold text-eye hover:underline">Incident Centre →</Link>}>
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/neighborhood-watch/verification" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 hover:border-eye">Verification Queue</Link>
          <Link href="/neighborhood-watch/broadcasts" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 hover:border-eye">Emergency Broadcasts</Link>
          <Link href="/neighborhood-watch/live-monitoring" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 hover:border-eye">Live Monitoring</Link>
          <Link href="/neighborhood-watch/smartwatch" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 hover:border-eye">Smartwatch Console</Link>
        </div>
      </Panel>
    </>
  );
}
