import { AppShell } from "../../components/app-shell";
import { PlaceholderNotice } from "../../components/placeholder-notice";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { PLACEHOLDER_DEPENDENCIES } from "../../lib/placeholder-dependencies";

const dependency = PLACEHOLDER_DEPENDENCIES.liveChats;

export default function LiveChatsPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Citizen support" title="Live Chats" action={<StatusBadge tone="success">0 open threads</StatusBadge>} />
      <Panel title="Conversation queue">
        <PlaceholderNotice title={dependency.title} endpoint={dependency.endpoint} note={dependency.note} />
        <p className="mt-4 text-sm text-muted">No chat threads are shown until a support chat API is available.</p>
      </Panel>
    </AppShell>
  );
}
