import Link from "next/link";
import { PageHeader, Panel, StatusBadge } from "../../../../components/ui";
import { fetchChannelMessages, fetchCommunityChannels } from "../../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function CommunityChannelPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const [channels, messages] = await Promise.all([fetchCommunityChannels(50), fetchChannelMessages(channelId)]);
  const channel = channels.find((entry) => entry.id === channelId);

  if (!channel) {
    return (
      <>
        <PageHeader eyebrow="Community channels" title="Channel not found" action={<StatusBadge tone="warning">Missing</StatusBadge>} />
        <Panel title="Navigation">
          <Link href="/neighborhood-watch/chat" className="text-sm font-semibold text-eye hover:underline">← Back to community chat</Link>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={channel.communityName}
        title={channel.name}
        action={<StatusBadge tone="info">{channel.type}</StatusBadge>}
      />
      <Panel title="Channel messages" aside={<Link href="/neighborhood-watch/chat" className="text-sm font-semibold text-eye hover:underline">All channels →</Link>}>
        <div className="grid gap-3">
          {messages.length ? messages.map((message) => (
            <article key={message.id} className="rounded-lg border border-line bg-surfaceMuted p-3">
              <p className="text-sm">{message.body}</p>
              <p className="mt-2 text-xs text-muted">Sender {message.senderId.slice(0, 8)} · {message.createdAt ? new Date(message.createdAt).toLocaleString() : "—"}</p>
            </article>
          )) : <p className="text-sm text-muted">No messages in this channel yet.</p>}
        </div>
      </Panel>
    </>
  );
}
