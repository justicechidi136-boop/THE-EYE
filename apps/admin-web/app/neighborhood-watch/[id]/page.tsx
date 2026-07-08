import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { communities, communityPosts, patrolSchedules, volunteers } from "../../../lib/mock-data";

export default async function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const community = communities.find((item) => item.id === id) ?? communities[0];
  return (
    <AppShell>
      <PageHeader eyebrow={community.hierarchy} title={community.name} action={<StatusBadge tone="info">{community.visibility}</StatusBadge>} />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Community structure">
          <div className="grid gap-3 text-sm">
            <p><strong>Level:</strong> {community.level}</p>
            <p><strong>Members:</strong> {community.members}</p>
            <p><strong>Pending approvals:</strong> {community.pending}</p>
            <p><strong>Verification confidence:</strong> {community.confidence}%</p>
          </div>
        </Panel>
        <Panel title="Community roles">
          <div className="grid gap-2 text-sm text-muted">
            {["Community Moderator", "Estate Admin", "Security Coordinator", "Police Liaison", "Volunteer Coordinator", "Verified Volunteer", "Resident"].map((role) => <span key={role} className="rounded-md bg-slate-50 px-3 py-2">{role}</span>)}
          </div>
        </Panel>
        <Panel title="Recent posts">
          <div className="grid gap-3">{communityPosts.map((post) => <div key={post.id} className="rounded-lg border border-line bg-slate-50 p-3"><p className="font-semibold">{post.title}</p><p className="text-sm text-muted">{post.type} - {post.status} - {post.confidence}%</p></div>)}</div>
        </Panel>
        <Panel title="Volunteers and patrols">
          <div className="grid gap-3">
            <p className="text-sm text-muted">{volunteers.length} nearby volunteers available.</p>
            <p className="text-sm text-muted">{patrolSchedules.length} patrol schedules active or upcoming.</p>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
