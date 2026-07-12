import { IncidentType } from "@the-eye/shared";
import { AppShell } from "../../components/app-shell";
import { IncidentTable } from "../../components/incident-widgets";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { fetchIncidentsByType } from "../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function MissingPersonsPage() {
  const missingPersons = await fetchIncidentsByType(IncidentType.MissingPerson);
  return (
    <AppShell>
      <PageHeader eyebrow="Case management" title="Missing person management" action={<StatusBadge tone="info">{missingPersons.length} open</StatusBadge>} />
      <Panel title="Active missing person reports">
        <IncidentTable incidents={missingPersons} />
      </Panel>
    </AppShell>
  );
}
