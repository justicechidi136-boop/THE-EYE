import { AppShell } from "../../components/app-shell";
import { IncidentMap, IncidentTable } from "../../components/incident-widgets";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { incidents } from "../../lib/mock-data";

export default function IncidentsPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Jurisdiction filtered" title="Incident list" action={<StatusBadge tone="info">{incidents.length} active</StatusBadge>} />
      <div className="grid gap-5">
        <IncidentMap incidents={incidents} />
        <Panel title="All incidents">
          <IncidentTable incidents={incidents} />
        </Panel>
      </div>
    </AppShell>
  );
}
