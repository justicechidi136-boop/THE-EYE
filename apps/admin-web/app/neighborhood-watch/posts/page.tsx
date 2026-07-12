import Link from "next/link";
import { CsocDataTable } from "../../../components/csoc/csoc-data-table";
import { PostVerifyButton } from "../../../components/csoc/post-verify-button";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchCommunityPosts } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function CommunityFeedPage() {
  const posts = await fetchCommunityPosts();

  return (
    <>
      <PageHeader
        eyebrow="Community feed moderation"
        title="Community Feed"
        action={<StatusBadge tone="info">{posts.length} posts</StatusBadge>}
      />
      <Panel title="Feed posts">
        <CsocDataTable
          columns={["Post", "Community", "Type", "Status", "Confidence", "Incident", "Actions"]}
          rows={posts.map((post) => [
            <div key={`t-${post.id}`}><p className="font-semibold">{post.title}</p><p className="text-xs text-muted">{post.author}</p></div>,
            post.community,
            post.type,
            <StatusBadge key={`s-${post.id}`} tone={post.status === "Verified" ? "success" : post.status === "False" ? "danger" : "warning"}>{post.status}</StatusBadge>,
            `${post.confidence}%`,
            post.linkedIncident !== "-" ? <Link key={`i-${post.id}`} href={`/incidents/${post.linkedIncident}`} className="text-eye hover:underline">{post.linkedIncident.slice(0, 8)}…</Link> : "—",
            <div key={`a-${post.id}`} className="flex flex-wrap gap-2">
              <PostVerifyButton postId={post.id} status="Verified" />
              <PostVerifyButton postId={post.id} status="False" />
              <PostVerifyButton postId={post.id} status="Disputed" />
            </div>,
          ])}
          emptyMessage="No community posts in jurisdiction."
        />
      </Panel>
    </>
  );
}
