import { AppShell } from "../../components/app-shell";
import { IncidentTable } from "../../components/incident-widgets";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { incidents } from "../../lib/mock-data";

export default function StolenVehiclesPage() {
  const stolenVehicles = incidents.filter((incident) => incident.type === "Stolen vehicle");
  return (
    <AppShell>
      <PageHeader eyebrow="Vehicle intelligence" title="Stolen vehicle management" action={<StatusBadge tone="warning">{stolenVehicles.length} watchlisted</StatusBadge>} />
      <Panel title="Stolen vehicle reports">
        <IncidentTable incidents={stolenVehicles} />
      </Panel>
    </AppShell>
  );
}
