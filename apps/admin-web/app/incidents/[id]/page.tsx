import { AppShell } from "../../../components/app-shell";
import { IncidentTimelinePanel } from "../../../components/dispatch/incident-timeline-panel";
import { IncidentDetail } from "../../../components/incident-widgets";
import { PageHeader, StatusBadge } from "../../../components/ui";
import { fetchEvidenceAccessLogs, fetchIncident } from "../../../lib/api/data";
import { fetchDispatchIncidentTimeline } from "../../../lib/api/dispatch";
import { canCreateDroneMission, canViewDroneSurveillance } from "../../../lib/drone-permissions";
import { getAdminSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAdminSession();
  const [incident, evidenceAccessLogs, unifiedTimeline] = await Promise.all([
    fetchIncident(id),
    fetchEvidenceAccessLogs(id),
    fetchDispatchIncidentTimeline(id),
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
      <IncidentDetail
        incident={incident}
        evidenceAccessLogs={evidenceAccessLogs}
        canLaunchDroneMission={canViewDroneSurveillance(session) && canCreateDroneMission(session)}
      />
      <div className="mt-5">
        <IncidentTimelinePanel
          incidentId={incident.id}
          entries={(unifiedTimeline.data ?? []) as Array<{ at?: string; type?: string; label?: string; silent?: boolean; details?: { media?: never } }>}
        />
      </div>
    </AppShell>
  );
}
