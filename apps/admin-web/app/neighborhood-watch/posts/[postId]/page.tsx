import Link from "next/link";
import { CommunityAudioEvidencePlayer } from "../../../../components/community-audio-evidence-player";
import { PageHeader, Panel, StatusBadge } from "../../../../components/ui";
import { fetchCommunityPostDetail } from "../../../../lib/api/data";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ postId: string }> };

export default async function CommunityPostDetailPage({ params }: PageProps) {
  const { postId } = await params;
  const post = await fetchCommunityPostDetail(postId);

  return (
    <>
      <PageHeader
        eyebrow="Neighborhood Watch"
        title={post.title}
        action={<StatusBadge tone="info">{post.status}</StatusBadge>}
      />
      <div className="grid gap-4">
        <Panel title="Post details">
          <p className="text-sm text-muted">{post.type} · {post.community}</p>
          {post.body ? <p className="mt-3 leading-7">{post.body}</p> : <p className="mt-3 text-muted">Voice-only post</p>}
        </Panel>
        <Panel title="Attachments">
          {post.media.length ? (
            post.media.map((item) => (
              <div key={item.id} className="mb-4 rounded-lg border border-line bg-surfaceMuted p-3">
                <p className="font-semibold">{item.type}</p>
                {item.type === "Audio" || item.contentType?.startsWith("audio/") ? (
                  <CommunityAudioEvidencePlayer postId={post.id} media={item} />
                ) : (
                  <p className="mt-2 text-sm text-muted">{item.name}</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">No attachments on this post.</p>
          )}
        </Panel>
        <Link href="/neighborhood-watch/posts" className="text-eye hover:underline">
          Back to community feed
        </Link>
      </div>
    </>
  );
}
