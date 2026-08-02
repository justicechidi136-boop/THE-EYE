import Link from "next/link";
import { ConsolePageHeader } from "../../../../components/console";
import { PageHeader, Panel, StatusBadge } from "../../../../components/ui";
import { fetchCommunityDetail, fetchCommunityChannels } from "../../../../lib/api/data";
import { getRouteById } from "../../../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const route = getRouteById("community-registry");
  const [detail, channels] = await Promise.all([fetchCommunityDetail(id), fetchCommunityChannels(50)]);
  const communityChannels = channels.filter((channel) => channel.communityId === id);

  if (!detail) {
    return (
      <PageHeader eyebrow="Community" title="Community not found" action={<StatusBadge tone="warning">Missing</StatusBadge>} />
    );
  }

  const { community, posts, volunteers, patrols, statistics } = detail;
  const stats = statistics as Record<string, unknown>;

  return (
    <>
      <ConsolePageHeader
        title={community.name}
        eyebrow={community.hierarchy}
        breadcrumbs={[...(route?.breadcrumb ?? []), community.name]}
        action={
          <div className="flex items-center gap-3">
            <Link href={`/neighborhood-watch/communities/${id}/edit`} className="text-sm font-semibold text-eye hover:underline">Edit community</Link>
            <StatusBadge tone="info">{community.visibility}</StatusBadge>
          </div>
        }
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Community statistics">
          <div className="grid gap-3 text-sm">
            <p><strong>Level:</strong> {community.level}</p>
            <p><strong>Status:</strong> {community.status ?? "Active"}</p>
            <p><strong>Members:</strong> {String(stats.memberCount ?? community.members)}</p>
            <p><strong>Active volunteers:</strong> {String(stats.activeVolunteers ?? volunteers.length)}</p>
            <p><strong>Patrols:</strong> {String(stats.patrolCount ?? patrols.length)}</p>
            <p><strong>Active alerts:</strong> {String(stats.activeAlerts ?? community.pending)}</p>
            <p><strong>Incidents:</strong> {String(stats.incidentCount ?? 0)}</p>
            <p><strong>Posts:</strong> {String(stats.postCount ?? posts.length)}</p>
            <p><strong>Pending approvals:</strong> {community.pending}</p>
            <p><strong>Safety index:</strong> {community.confidence}%</p>
            <Link href="/neighborhood-watch/map" className="text-eye hover:underline">View on map →</Link>
          </div>
        </Panel>
        <Panel title="Community channels">
          <div className="grid gap-2">
            {communityChannels.length ? communityChannels.map((channel) => (
              <Link
                key={channel.id}
                href={`/neighborhood-watch/chat/${channel.id}`}
                className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye"
              >
                {channel.name} · {channel.type}
              </Link>
            )) : <p className="text-sm text-muted">No channels returned for this community.</p>}
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
              <Link key={p.id} href={`/neighborhood-watch/patrols/${p.id}`} className="rounded-lg border border-line bg-surfaceMuted p-3 text-sm transition-colors hover:border-eye">
                <p className="font-semibold">{p.title}</p>
                <p className="text-muted">{p.status} · {p.checkpoints} checkpoints</p>
              </Link>
            )) : <p className="text-sm text-muted">{volunteers.length} volunteers · no patrol history</p>}
          </div>
        </Panel>
      </div>
    </>
  );
}
