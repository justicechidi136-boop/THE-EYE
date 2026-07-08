import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { MetricCard, PageHeader, Panel, StatusBadge } from "../../components/ui";
import { communities, communityPosts } from "../../lib/mock-data";

export default function NeighborhoodWatchPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Community safety platform" title="Neighborhood Watch" action={<StatusBadge tone="success">{communities.length} communities</StatusBadge>} />
      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <MetricCard label="Members" value={String(communities.reduce((sum, community) => sum + community.members, 0))} />
        <MetricCard label="Pending approvals" value={String(communities.reduce((sum, community) => sum + community.pending, 0))} />
        <MetricCard label="Community posts" value={String(communityPosts.length)} />
        <MetricCard label="Avg confidence" value="75%" />
      </section>
      <Panel title="Communities list">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-muted">
              <tr><th className="px-4 py-3">Community</th><th className="px-4 py-3">Hierarchy</th><th className="px-4 py-3">Members</th><th className="px-4 py-3">Approvals</th><th className="px-4 py-3">Confidence</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {communities.map((community) => (
                <tr key={community.id}>
                  <td className="px-4 py-3"><Link href={`/neighborhood-watch/${community.id}`} className="font-semibold hover:text-eye">{community.name}</Link><p className="text-xs text-muted">{community.level} - {community.visibility}</p></td>
                  <td className="px-4 py-3 text-muted">{community.hierarchy}</td>
                  <td className="px-4 py-3">{community.members}</td>
                  <td className="px-4 py-3"><StatusBadge tone={community.pending ? "warning" : "success"}>{community.pending}</StatusBadge></td>
                  <td className="px-4 py-3"><StatusBadge tone={community.confidence >= 80 ? "success" : "info"}>{community.confidence}%</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
