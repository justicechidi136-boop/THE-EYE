import { CsocDataTable } from "../../../components/csoc/csoc-data-table";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchPatrols } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function PatrolManagementPage() {
  const patrols = await fetchPatrols();

  return (
    <>
      <PageHeader
        eyebrow="Patrol operations"
        title="Patrol Management"
        action={<StatusBadge tone="success">{patrols.length} schedules</StatusBadge>}
      />
      <Panel title="Patrol schedules" aside={<span className="text-xs text-muted">Create via POST /v1/neighborhood-watch/communities/:id/patrols</span>}>
        <CsocDataTable
          columns={["Patrol", "Community", "Status", "Volunteers", "Checkpoints"]}
          rows={patrols.map((p) => [
            p.title,
            p.community,
            <StatusBadge key={`s-${p.id}`} tone={p.status === "Active" ? "success" : "info"}>{p.status}</StatusBadge>,
            String(p.volunteers),
            String(p.checkpoints),
          ])}
          emptyMessage="No patrol schedules in assigned communities."
        />
      </Panel>
    </>
  );
}
