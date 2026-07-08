import { AppShell } from "../../components/app-shell";
import { IncidentTable } from "../../components/incident-widgets";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { incidents } from "../../lib/mock-data";

export default function EmergencyPage() {
  const emergencyIncidents = incidents.filter((incident) => incident.priority === "P1");
  return (
    <AppShell>
      <PageHeader eyebrow="Immediate response" title="Emergency priority queue" action={<StatusBadge tone="danger">P1 life threatening</StatusBadge>} />
      <Panel title="Unacknowledged and active emergencies">
        <IncidentTable incidents={emergencyIncidents} />
      </Panel>
    </AppShell>
  );
}
