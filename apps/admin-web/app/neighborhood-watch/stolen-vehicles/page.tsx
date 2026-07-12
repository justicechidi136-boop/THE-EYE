import { CsocDataTable } from "../../../components/csoc/csoc-data-table";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchIncidents } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function StolenVehiclesPage() {
  const incidents = await fetchIncidents();
  const stolen = incidents.filter((i) => i.type === "StolenVehicle");

  return (
    <>
      <PageHeader eyebrow="Stolen vehicles" title="Stolen Vehicles" action={<StatusBadge tone="danger">{stolen.length} reports</StatusBadge>} />
      <Panel title="Stolen vehicle reports">
        <CsocDataTable
          columns={["Report", "Status", "Priority", "Location", "Confidence"]}
          rows={stolen.map((i) => [
            i.title,
            i.status,
            i.priority,
            i.location,
            `${i.confidenceScore}%`,
          ])}
          emptyMessage="No stolen vehicle reports in jurisdiction."
        />
      </Panel>
    </>
  );
}
