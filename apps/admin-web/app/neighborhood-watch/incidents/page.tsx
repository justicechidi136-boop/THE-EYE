import Link from "next/link";
import { CsocDataTable } from "../../../components/csoc/csoc-data-table";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchIncidents } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function IncidentCentrePage() {
  const incidents = await fetchIncidents();
  const communityIncidents = incidents.filter((i) => i.type === "CommunitySafety" || i.status !== "Closed");

  return (
    <>
      <PageHeader
        eyebrow="Live incident queue"
        title="Incident Centre"
        action={<StatusBadge tone="warning">{communityIncidents.length} active</StatusBadge>}
      />
      <Panel title="Incident queue">
        <CsocDataTable
          columns={["Incident", "Type", "Priority", "Status", "Confidence", "Location", ""]}
          rows={communityIncidents.map((i) => [
            <div key={`t-${i.id}`}><p className="font-semibold">{i.title}</p><p className="text-xs text-muted">{i.id}</p></div>,
            i.type,
            <StatusBadge key={`p-${i.id}`} tone={i.priority === "P1" ? "danger" : i.priority === "P2" ? "warning" : "info"}>{i.priority}</StatusBadge>,
            i.status,
            `${i.confidenceScore}%`,
            i.location,
            <Link key={`l-${i.id}`} href={`/incidents/${i.id}`} className="text-sm font-semibold text-eye hover:underline">Open</Link>,
          ])}
          emptyMessage="No incidents in queue."
        />
      </Panel>
    </>
  );
}
