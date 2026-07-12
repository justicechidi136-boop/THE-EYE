import { CsocApiNotice } from "../../../components/csoc/csoc-data-table";
import { CsocMetricGrid } from "../../../components/csoc/csoc-metric-grid";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchCommunities, fetchCommunityPosts, fetchIncidents, fetchVolunteers } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function AiIntelligencePage() {
  const [communities, posts, incidents, volunteers] = await Promise.all([
    fetchCommunities(),
    fetchCommunityPosts(),
    fetchIncidents(),
    fetchVolunteers(),
  ]);

  const avgConfidence = communities.length
    ? Math.round(communities.reduce((s, c) => s + c.confidence, 0) / communities.length)
    : 0;
  const hotspots = incidents.filter((i) => i.type === "CommunitySafety").slice(0, 5);
  const falseRate = posts.length
    ? Math.round((posts.filter((p) => p.status === "False").length / posts.length) * 100)
    : 0;

  return (
    <>
      <PageHeader
        eyebrow="AI intelligence"
        title="AI Intelligence"
        action={<StatusBadge tone="info">Risk score {100 - avgConfidence}%</StatusBadge>}
      />
      <CsocMetricGrid
        metrics={[
          { label: "Community Risk Score", value: `${100 - avgConfidence}%`, accent: "eyeOrange" },
          { label: "Crime Hotspots", value: String(hotspots.length) },
          { label: "False Report Rate", value: `${falseRate}%` },
          { label: "Volunteer Coverage", value: String(volunteers.length) },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Crime hotspots (from incidents)">
          {hotspots.length ? hotspots.map((h) => (
            <div key={h.id} className="mb-2 rounded-lg border border-line bg-surfaceMuted p-3 text-sm">
              <p className="font-semibold">{h.title}</p>
              <p className="text-muted">{h.location} · {h.confidenceScore}% confidence</p>
            </div>
          )) : <p className="text-sm text-muted">No hotspot data in jurisdiction.</p>}
        </Panel>
        <Panel title="Verification insights">
          {posts.slice(0, 6).map((p) => (
            <div key={p.id} className="mb-2 flex items-center justify-between rounded-lg border border-line bg-surfaceMuted p-3 text-sm">
              <span>{p.title}</span>
              <StatusBadge tone={p.confidence >= 80 ? "success" : "warning"}>{p.confidence}%</StatusBadge>
            </div>
          ))}
        </Panel>
      </div>
      <CsocApiNotice
        notice={{
          title: "Predictive crime analysis",
          endpoint: "GET /v1/analytics/crime-prediction",
          note: "Full predictive models and repeat-offender tracking require a dedicated analytics ML endpoint. Current insights derive from live incidents and post confidence scores.",
        }}
      />
    </>
  );
}
