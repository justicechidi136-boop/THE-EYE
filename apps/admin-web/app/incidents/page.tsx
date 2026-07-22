import { AppShell } from "../../components/app-shell";
import { IncidentFilterBar } from "../../components/incident-filter";
import { IncidentMap, IncidentTable } from "../../components/incident-widgets";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { fetchIncidents } from "../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; type?: string }>;
}) {
  const params = await searchParams;
  const incidents = await fetchIncidents({
    status: params.status,
    priority: params.priority,
    type: params.type,
  });

  return (
    <AppShell>
      <PageHeader eyebrow="Jurisdiction filtered" title="Incident list" action={<StatusBadge tone="info">{incidents.length} active</StatusBadge>} />
      <div className="grid gap-5">
        <Panel title="Filters">
          <IncidentFilterBar />
        </Panel>
        <IncidentMap incidents={incidents} />
        <Panel title="All incidents">
          <IncidentTable incidents={incidents} />
        </Panel>
      </div>
    </AppShell>
  );
}
