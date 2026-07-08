import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { communities } from "../../../lib/mock-data";

export default function MembershipApprovalsPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Private community access" title="Membership approvals" action={<StatusBadge tone="warning">Moderator action</StatusBadge>} />
      <Panel title="Pending access requests">
        <div className="grid gap-3">
          {communities.filter((community) => community.pending > 0).map((community) => (
            <div key={community.id} className="grid gap-2 rounded-lg border border-line bg-slate-50 p-4 md:grid-cols-[1fr_120px_160px] md:items-center">
              <div><p className="font-semibold">{community.name}</p><p className="text-sm text-muted">{community.hierarchy}</p></div>
              <StatusBadge tone="warning">{community.pending} pending</StatusBadge>
              <button className="rounded-md bg-eye px-4 py-2 text-sm font-semibold text-white">Review</button>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
