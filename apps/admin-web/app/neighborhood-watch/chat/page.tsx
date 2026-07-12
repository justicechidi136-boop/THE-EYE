import { CsocApiNotice } from "../../../components/csoc/csoc-data-table";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchCommunities } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

const CHANNELS = [
  "General", "Emergency", "Security", "Volunteers", "Parents",
  "Women Safety", "Business Owners", "Estate Committee",
];

export default async function CommunityChatPage() {
  const communities = await fetchCommunities();

  return (
    <>
      <PageHeader
        eyebrow="Community channels"
        title="Community Chat"
        action={<StatusBadge tone="info">{communities.length} communities</StatusBadge>}
      />
      <Panel title="Channel types">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CHANNELS.map((ch) => (
            <span key={ch} className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold">{ch}</span>
          ))}
        </div>
      </Panel>
      <Panel title="Moderator tools">
        <p className="mb-3 text-sm text-muted">Mute, delete, pin, and announcements connect to community channel message APIs.</p>
        <CsocApiNotice
          notice={{
            title: "Channel message moderation",
            endpoint: "GET/POST /v1/neighborhood-watch/channels/:channelId/messages",
            note: "Select a community to view its channels. Messages load per channel ID from community detail.",
          }}
        />
      </Panel>
      <Panel title="Communities with channels">
        <ul className="grid gap-2">
          {communities.map((c) => (
            <li key={c.id} className="rounded-lg border border-line bg-surfaceMuted px-4 py-3 text-sm">
              <span className="font-semibold">{c.name}</span>
              <span className="text-muted"> — {c.members} members</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
