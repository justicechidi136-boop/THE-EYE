import { AppShell } from "../../../components/app-shell";
import { IncidentDetail } from "../../../components/incident-widgets";
import { PageHeader, StatusBadge } from "../../../components/ui";
import { fetchEvidenceAccessLogs, fetchIncident } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [incident, evidenceAccessLogs] = await Promise.all([
    fetchIncident(id),
    fetchEvidenceAccessLogs(id),
  ]);

  if (!incident) {
    return (
      <AppShell>
        <PageHeader eyebrow="Incident" title="Incident not found" action={<StatusBadge tone="warning">Missing</StatusBadge>} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader eyebrow={incident.id} title={incident.title} action={<StatusBadge tone="info">{incident.status}</StatusBadge>} />
      <IncidentDetail incident={incident} evidenceAccessLogs={evidenceAccessLogs} />
    </AppShell>
  );
}
