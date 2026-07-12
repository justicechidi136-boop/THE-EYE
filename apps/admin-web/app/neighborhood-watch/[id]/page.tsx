import Link from "next/link";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchCommunityDetail } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await fetchCommunityDetail(id);

  if (!detail) {
    return (
      <PageHeader eyebrow="Community" title="Community not found" action={<StatusBadge tone="warning">Missing</StatusBadge>} />
    );
  }

  const { community, posts, volunteers, patrols } = detail;

  return (
    <>
      <PageHeader eyebrow={community.hierarchy} title={community.name} action={<StatusBadge tone="info">{community.visibility}</StatusBadge>} />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Community statistics">
          <div className="grid gap-3 text-sm">
            <p><strong>Level:</strong> {community.level}</p>
            <p><strong>Members:</strong> {community.members}</p>
            <p><strong>Pending approvals:</strong> {community.pending}</p>
            <p><strong>Safety index:</strong> {community.confidence}%</p>
            <Link href="/neighborhood-watch/map" className="text-eye hover:underline">View on map →</Link>
          </div>
        </Panel>
        <Panel title="Community roles">
          <div className="grid gap-2 text-sm text-muted">
            {["Community Moderator", "Estate Admin", "Security Coordinator", "Police Liaison", "Volunteer Coordinator", "Verified Volunteer", "Resident"].map((role) => (
              <span key={role} className="rounded-md bg-surfaceMuted px-3 py-2">{role}</span>
            ))}
          </div>
        </Panel>
        <Panel title="Recent posts">
          <div className="grid gap-3">
            {posts.map((post) => (
              <div key={post.id} className="rounded-lg border border-line bg-surfaceMuted p-3">
                <p className="font-semibold">{post.title}</p>
                <p className="text-sm text-muted">{post.type} · {post.status} · {post.confidence}%</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Patrol history">
          <div className="grid gap-3">
            {patrols.length ? patrols.map((p) => (
              <div key={p.id} className="rounded-lg border border-line bg-surfaceMuted p-3 text-sm">
                <p className="font-semibold">{p.title}</p>
                <p className="text-muted">{p.status} · {p.checkpoints} checkpoints</p>
              </div>
            )) : <p className="text-sm text-muted">{volunteers.length} volunteers · no patrol history</p>}
          </div>
        </Panel>
      </div>
    </>
  );
}
