import { IncidentType } from "@the-eye/shared";
import { AppShell } from "../../components/app-shell";
import { IncidentTable } from "../../components/incident-widgets";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { fetchIncidentsByType } from "../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function StolenVehiclesPage() {
  const stolenVehicles = await fetchIncidentsByType(IncidentType.StolenVehicle);
  return (
    <AppShell>
      <PageHeader eyebrow="Vehicle intelligence" title="Stolen vehicle management" action={<StatusBadge tone="warning">{stolenVehicles.length} watchlisted</StatusBadge>} />
      <Panel title="Stolen vehicle reports">
        <IncidentTable incidents={stolenVehicles} />
      </Panel>
    </AppShell>
  );
}
