import { CsocMetricGrid } from "../../../components/csoc/csoc-metric-grid";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchCommunities, fetchCommunityPosts, fetchPatrols, fetchVolunteers } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function CommunityAnalyticsPage() {
  const [communities, communityPosts, volunteers, patrolSchedules] = await Promise.all([
    fetchCommunities(),
    fetchCommunityPosts(),
    fetchVolunteers(),
    fetchPatrols(),
  ]);

  const verified = communityPosts.filter((post) => post.status === "Verified").length;
  const avgConfidence = communityPosts.length
    ? Math.round(communityPosts.reduce((s, p) => s + p.confidence, 0) / communityPosts.length)
    : 0;

  return (
    <>
      <PageHeader eyebrow="Community intelligence" title="Analytics" action={<StatusBadge tone="success">Jurisdiction scoped</StatusBadge>} />
      <CsocMetricGrid
        metrics={[
          { label: "Communities", value: String(communities.length) },
          { label: "Verified Posts", value: String(verified), accent: "eye" },
          { label: "Volunteers", value: String(volunteers.length) },
          { label: "Patrol Coverage", value: String(patrolSchedules.length) },
          { label: "Avg Confidence", value: `${avgConfidence}%` },
          { label: "Safety Index", value: communities.length ? `${Math.round(communities.reduce((s, c) => s + c.confidence, 0) / communities.length)}%` : "0%" },
        ]}
      />
      <Panel title="Crime trends & verification speed">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {communityPosts.slice(0, 9).map((post) => (
            <div key={post.id} className="rounded-lg border border-line bg-surfaceMuted p-4">
              <p className="font-semibold">{post.type}</p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface">
                <div className="h-full bg-eye" style={{ width: `${post.confidence}%` }} />
              </div>
              <p className="mt-2 text-sm text-muted">{post.confidence}% confidence · {post.status}</p>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
