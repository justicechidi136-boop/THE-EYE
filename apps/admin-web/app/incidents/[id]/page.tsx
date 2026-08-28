import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { IncidentDetail } from "../../../components/incident-widgets";
import { PageHeader, StatusBadge } from "../../../components/ui";
import { fetchEvidenceAccessLogs, fetchIncident, listAgencies } from "../../../lib/api/data";
import { fetchDispatchIncidentTimeline } from "../../../lib/api/dispatch";
import { canCreateDroneMission, canViewDroneSurveillance } from "../../../lib/drone-permissions";
import { reportDetailsTitle, reportPublicReference, type ReportTimelineEntry } from "../../../lib/report-details-presentation";
import { getAdminSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAdminSession();
  const [incident, evidenceAccessLogs, unifiedTimeline, agencies] = await Promise.all([
    fetchIncident(id),
    fetchEvidenceAccessLogs(id),
    fetchDispatchIncidentTimeline(id),
    listAgencies({ isActive: "true", isDispatchable: "true" }),
  ]);

  if (!incident) {
    return (
      <AppShell>
        <PageHeader eyebrow="Report" title="Report not found" action={<StatusBadge tone="warning">Missing</StatusBadge>} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link href="/incidents" className="mb-3 inline-flex text-sm font-semibold text-eye hover:underline">← Back to Reports</Link>
      <PageHeader eyebrow={`Report ${reportPublicReference(incident)}`} title={reportDetailsTitle(incident)} action={<StatusBadge tone="info">{incident.status}</StatusBadge>} />
      <IncidentDetail
        incident={incident}
        evidenceAccessLogs={evidenceAccessLogs}
        timelineEntries={(unifiedTimeline.data ?? []) as ReportTimelineEntry[]}
        agencies={agencies}
        canLaunchDroneMission={canViewDroneSurveillance(session) && canCreateDroneMission(session)}
      />
    </AppShell>
  );
}
