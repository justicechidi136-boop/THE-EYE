import Link from "next/link";
import { CsocMetricGrid } from "../../../components/csoc/csoc-metric-grid";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchAiIntelligenceDashboard } from "../../../lib/api/ai-intelligence";

export const dynamic = "force-dynamic";

export default async function AiIntelligencePage() {
  const dashboard = await fetchAiIntelligenceDashboard({ windowDays: 30 });

  return (
    <>
      <PageHeader
        eyebrow="AI intelligence"
        title="AI Intelligence"
        action={<StatusBadge tone="info">Risk score {dashboard.communityRiskScore}%</StatusBadge>}
      />
      <CsocMetricGrid
        metrics={[
          { label: "Community Risk Score", value: `${dashboard.communityRiskScore}%`, accent: "eyeOrange", href: "/neighborhood-watch/analytics" },
          { label: "Crime Hotspots", value: String(dashboard.crimeHotspotCount), href: "/neighborhood-watch/incidents" },
          { label: "False Report Rate", value: `${dashboard.falseReportRate}%`, href: "/neighborhood-watch/reports" },
          { label: "Volunteer Coverage", value: String(dashboard.volunteerCoverage), href: "/neighborhood-watch/volunteers" },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Crime hotspots">
          {dashboard.hotspots.length ? dashboard.hotspots.map((hotspot) => (
            <Link key={hotspot.id} href={`/incidents/${hotspot.id}`} className="mb-2 block rounded-lg border border-line bg-surfaceMuted p-3 text-sm transition-colors hover:border-eye">
              <p className="font-semibold">{hotspot.title}</p>
              <p className="text-muted">{hotspot.location} · {hotspot.confidenceScore}% confidence</p>
            </Link>
          )) : <p className="text-sm text-muted">No hotspot data in jurisdiction.</p>}
        </Panel>
        <Panel title="Verification insights">
          {dashboard.verificationInsights.length ? dashboard.verificationInsights.map((post) => (
            <div key={post.id} className="mb-2 flex items-center justify-between rounded-lg border border-line bg-surfaceMuted p-3 text-sm">
              <div>
                <p className="font-semibold">{post.title}</p>
                <p className="text-xs text-muted">{post.communityName} · {post.verificationStatus}</p>
              </div>
              <StatusBadge tone={post.confidence >= 80 ? "success" : "warning"}>{post.confidence}%</StatusBadge>
            </div>
          )) : <p className="text-sm text-muted">No verification insights in the current window.</p>}
        </Panel>
      </div>
      <p className="text-xs text-muted">
        Generated {new Date(dashboard.generatedAt).toLocaleString()} from `GET /v1/neighborhood-watch/admin/ai-intelligence`
        ({dashboard.windowDays}-day window, {dashboard.communitiesTracked} communities tracked).
      </p>
    </>
  );
}
