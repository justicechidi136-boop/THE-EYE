import { CsocDataTable } from "../../../components/csoc/csoc-data-table";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchIncidents } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function MissingPersonsPage() {
  const incidents = await fetchIncidents();
  const missing = incidents.filter((i) => i.type === "MissingPerson");

  return (
    <>
      <PageHeader eyebrow="Missing persons" title="Missing Persons" action={<StatusBadge tone="warning">{missing.length} cases</StatusBadge>} />
      <Panel title="Active missing person reports">
        <CsocDataTable
          columns={["Case", "Status", "Priority", "Location", "Confidence", "Reported"]}
          rows={missing.map((i) => [
            i.title,
            i.status,
            i.priority,
            i.location,
            `${i.confidenceScore}%`,
            i.createdAt ?? "—",
          ])}
          emptyMessage="No missing person cases in jurisdiction. Data from live incidents API."
        />
      </Panel>
    </>
  );
}
