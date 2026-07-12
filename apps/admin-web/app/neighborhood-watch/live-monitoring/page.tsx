import Link from "next/link";
import { CsocMap } from "../../../components/csoc/csoc-map";
import { CsocMetricGrid } from "../../../components/csoc/csoc-metric-grid";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import {
  fetchBroadcasts,
  fetchCommunityPosts,
  fetchCsocMapMarkers,
  fetchIncidents,
  fetchLiveVideoSessions,
  fetchPatrols,
  fetchSosEvents,
  fetchVolunteers,
} from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function LiveMonitoringPage() {
  const [incidents, broadcasts, posts, volunteers, patrols, sos, liveSessions, markers] = await Promise.all([
    fetchIncidents(),
    fetchBroadcasts(),
    fetchCommunityPosts(),
    fetchVolunteers(),
    fetchPatrols(),
    fetchSosEvents(),
    fetchLiveVideoSessions(),
    fetchCsocMapMarkers(),
  ]);

  const liveIncidents = incidents.filter((i) => !["Closed", "Resolved"].includes(i.status));

  return (
    <>
      <PageHeader
        eyebrow="Real-time operations centre"
        title="Live Monitoring"
        action={<StatusBadge tone="danger">{sos.filter((e) => e.status === "Active").length} active SOS</StatusBadge>}
      />
      <CsocMetricGrid
        metrics={[
          { label: "Live Videos", value: String(liveSessions.length), accent: "eyeOrange" },
          { label: "Incident Queue", value: String(liveIncidents.length) },
          { label: "Community Alerts", value: String(posts.filter((p) => p.status === "Pending Verification").length) },
          { label: "Active Broadcasts", value: String(broadcasts.filter((b) => b.status === "Active").length) },
          { label: "Volunteers", value: String(volunteers.length) },
          { label: "Patrols", value: String(patrols.length) },
        ]}
      />
      <CsocMap markers={markers} title="Live GIS — movement trails, volunteer & patrol locations" />
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Live video sessions">
          {liveSessions.length ? liveSessions.map((s) => (
            <div key={s.id} className="mb-2 rounded-lg border border-line bg-surfaceMuted p-3 text-sm">
              <p className="font-semibold">{s.incidentId}</p>
              <p className="text-muted">{s.status} · {s.roomName}</p>
              <Link href="/live-video" className="text-eye hover:underline">Open live video →</Link>
            </div>
          )) : <p className="text-sm text-muted">No active live video sessions.</p>}
        </Panel>
        <Panel title="Smartwatch SOS">
          {sos.slice(0, 8).map((e) => (
            <div key={e.id} className="mb-2 rounded-lg border border-line bg-surfaceMuted p-3 text-sm">
              <p className="font-semibold">{e.user}</p>
              <p className="text-muted">{e.status} · {e.triggeredAt}</p>
            </div>
          ))}
        </Panel>
      </div>
    </>
  );
}
