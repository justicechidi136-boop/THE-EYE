import { AppShell } from "../../../components/app-shell";
import { IncidentDetail } from "../../../components/incident-widgets";
import { PageHeader, StatusBadge } from "../../../components/ui";
import { incidents } from "../../../lib/mock-data";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const incident = incidents.find((item) => item.id === id) ?? incidents[0];

  return (
    <AppShell>
      <PageHeader eyebrow={incident.id} title={incident.title} action={<StatusBadge tone="info">{incident.status}</StatusBadge>} />
      <IncidentDetail incident={incident} />
    </AppShell>
  );
}
