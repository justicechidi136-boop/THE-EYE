import Link from "next/link";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchCommunityChannels } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function CommunityChatPage() {
  const channels = await fetchCommunityChannels();

  return (
    <>
      <PageHeader
        eyebrow="Community channels"
        title="Community Chat"
        action={<StatusBadge tone="info">{channels.length} channels</StatusBadge>}
      />
      <Panel title="Live community channels">
        <p className="mb-4 text-sm text-muted">
          Channels are loaded from <code className="text-xs">GET /v1/neighborhood-watch/communities/:id</code> and messages from{" "}
          <code className="text-xs">GET /v1/neighborhood-watch/channels/:channelId/messages</code>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {channels.length ? channels.map((channel) => (
            <Link
              key={channel.id}
              href={`/neighborhood-watch/chat/${channel.id}`}
              className="rounded-lg border border-line bg-surfaceMuted px-4 py-3 transition-colors hover:border-eye"
            >
              <p className="text-sm font-semibold">{channel.name}</p>
              <p className="mt-1 text-xs text-muted">{channel.communityName} · {channel.type}</p>
              <p className="mt-2 text-xs font-semibold text-eye">Open channel →</p>
            </Link>
          )) : (
            <p className="text-sm text-muted">No community channels found in the current scope.</p>
          )}
        </div>
      </Panel>
    </>
  );
}
