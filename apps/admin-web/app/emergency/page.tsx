import { AppShell } from "../../components/app-shell";
import { IncidentMap, IncidentTable } from "../../components/incident-widgets";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { fetchIncidents } from "../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function EmergencyPage() {
  const incidents = (await fetchIncidents()).filter((incident) => incident.priority === "P1");

  return (
    <AppShell>
      <PageHeader eyebrow="P1 response" title="Emergency queue" action={<StatusBadge tone="danger">{incidents.length} active</StatusBadge>} />
      <div className="grid gap-5">
        <IncidentMap incidents={incidents} />
        <Panel title="Life-threatening incidents">
          <IncidentTable incidents={incidents} />
        </Panel>
      </div>
    </AppShell>
  );
}
