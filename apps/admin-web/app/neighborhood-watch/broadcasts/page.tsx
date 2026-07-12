import { BroadcastCreateForm } from "../../../components/broadcast-create-form";
import { CsocDataTable } from "../../../components/csoc/csoc-data-table";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchBroadcasts } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function CsocBroadcastsPage() {
  const broadcasts = await fetchBroadcasts();

  return (
    <>
      <PageHeader
        eyebrow="Emergency communications"
        title="Emergency Broadcasts"
        action={<StatusBadge tone="success">{broadcasts.length} broadcasts</StatusBadge>}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Create broadcast">
          <BroadcastCreateForm />
        </Panel>
        <Panel title="Audience targeting">
          <p className="text-sm text-muted">Target by country, state, LGA, community, estate, street, or radius via the broadcast API. Connected to <code className="text-xs">POST /v1/broadcasts</code>.</p>
        </Panel>
      </div>
      <Panel title="Broadcast history">
        <CsocDataTable
          columns={["Title", "Type", "Severity", "Status", "Target", "Recipients", "Delivery"]}
          rows={broadcasts.map((b) => [
            b.title,
            b.type,
            b.severity,
            <StatusBadge key={`s-${b.id}`} tone={b.status === "Active" ? "success" : "neutral"}>{b.status}</StatusBadge>,
            b.target,
            String(b.recipients),
            b.delivery,
          ])}
          emptyMessage="No broadcasts in jurisdiction."
        />
      </Panel>
    </>
  );
}
