import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { communityPosts } from "../../../lib/mock-data";

export default function CommunityPostsPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Community feed oversight" title="Community posts" action={<StatusBadge tone="info">{communityPosts.length} posts</StatusBadge>} />
      <Panel title="Posts">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-muted"><tr><th className="px-4 py-3">Post</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Confidence</th><th className="px-4 py-3">Incident</th></tr></thead>
            <tbody className="divide-y divide-line">{communityPosts.map((post) => <tr key={post.id}><td className="px-4 py-3"><p className="font-semibold">{post.title}</p><p className="text-xs text-muted">{post.community} - {post.author}</p></td><td className="px-4 py-3">{post.type}</td><td className="px-4 py-3"><StatusBadge tone={post.status === "Verified" ? "success" : post.status === "Disputed" ? "danger" : "warning"}>{post.status}</StatusBadge></td><td className="px-4 py-3">{post.confidence}%</td><td className="px-4 py-3">{post.linkedIncident}</td></tr>)}</tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
