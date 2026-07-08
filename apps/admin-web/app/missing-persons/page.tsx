import { AppShell } from "../../components/app-shell";
import { IncidentTable } from "../../components/incident-widgets";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { incidents } from "../../lib/mock-data";

export default function MissingPersonsPage() {
  const missingPersons = incidents.filter((incident) => incident.type === "Missing person");
  return (
    <AppShell>
      <PageHeader eyebrow="Case management" title="Missing person management" action={<StatusBadge tone="info">{missingPersons.length} open</StatusBadge>} />
      <Panel title="Active missing person reports">
        <IncidentTable incidents={missingPersons} />
      </Panel>
    </AppShell>
  );
}
