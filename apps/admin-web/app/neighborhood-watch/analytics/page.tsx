import { AppShell } from "../../../components/app-shell";
import { MetricCard, PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { communities, communityPosts, patrolSchedules, volunteers } from "../../../lib/mock-data";

export default function CommunityAnalyticsPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Community intelligence" title="Community analytics" action={<StatusBadge tone="success">Jurisdiction scoped</StatusBadge>} />
      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <MetricCard label="Communities" value={String(communities.length)} />
        <MetricCard label="Verified posts" value={String(communityPosts.filter((post) => post.status === "Verified").length)} />
        <MetricCard label="Volunteers" value={String(volunteers.length)} />
        <MetricCard label="Patrols" value={String(patrolSchedules.length)} />
      </section>
      <Panel title="Verification mix">
        <div className="grid gap-3 md:grid-cols-3">{communityPosts.map((post) => <div key={post.id} className="rounded-lg border border-line bg-slate-50 p-4"><p className="font-semibold">{post.type}</p><div className="mt-3 h-3 overflow-hidden rounded-full bg-white"><div className="h-full bg-eye" style={{ width: `${post.confidence}%` }} /></div><p className="mt-2 text-sm text-muted">{post.confidence}% confidence</p></div>)}</div>
      </Panel>
    </AppShell>
  );
}
