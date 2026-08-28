import Link from "next/link";
import type { AgencyView, EvidenceAccessEntry, Incident } from "../lib/types/admin-views";
import { verificationStatusFromScore } from "../lib/verification";
import { EmptyState, TableScrollHint } from "./form-primitives";
import { Panel, StatusBadge } from "./ui";
import { VerificationStatusBadge } from "./verification-ui";
import { LocationTrailMap } from "./location-trail-map";
import { IncidentAdminActions } from "./incident-admin-actions";
import { LaunchDroneMissionButton } from "./drone/launch-drone-mission-button";
import { humanPriority } from "../lib/admin-presentation";
import { formatReportCapturedAt, type ReportTimelineEntry } from "../lib/report-details-presentation";
import { reportReporterLabel, reportTypeLabel } from "../lib/report-centre-presentation";
import { ReportEvidenceGallery } from "./report-evidence-gallery";
import { ReportActivityPanels } from "./report-activity-panels";

function priorityTone(priority: Incident["priority"]) {
  if (priority === "P1") return "danger";
  if (priority === "P2") return "warning";
  if (priority === "P3") return "info";
  return "neutral";
}

function confidenceTone(score: number) {
  if (score >= 85) return "success";
  if (score >= 70) return "info";
  if (score >= 45) return "warning";
  return "danger";
}

export function IncidentMap({ incidents }: { incidents: Incident[] }) {
  const points = incidents.flatMap((incident) => incident.locationHistory.length
    ? incident.locationHistory
    : [{ latitude: incident.gps.lat, longitude: incident.gps.lng, capturedAt: incident.createdAt ?? new Date(0).toISOString() }]);
  return <LocationTrailMap title="Live incident map" initialPoints={points} locationLabel={`${incidents.length} incident position${incidents.length === 1 ? "" : "s"} in scope`} />;
}

export function IncidentTable({ incidents }: { incidents: Incident[] }) {
  if (!incidents.length) {
    return <EmptyState title="No incidents in this view" description="New reports will appear here when citizens submit incidents in your jurisdiction." />;
  }

  return (
    <div>
      <TableScrollHint />
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead className="bg-surfaceMuted text-xs uppercase text-muted">
          <tr>
            <th scope="col" className="px-4 py-3">Incident</th>
            <th scope="col" className="px-4 py-3">Priority</th>
            <th scope="col" className="px-4 py-3">Verification</th>
            <th scope="col" className="px-4 py-3">Confidence</th>
            <th scope="col" className="px-4 py-3">GPS</th>
            <th scope="col" className="px-4 py-3">Reporter</th>
            <th scope="col" className="px-4 py-3">Agency</th>
            <th scope="col" className="px-4 py-3">Response</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {incidents.map((incident) => (
            <tr key={incident.id} className="align-top hover:bg-surfaceMuted">
              <td className="px-4 py-3">
                <Link href={`/incidents/${incident.id}`} className="font-semibold text-ink hover:text-eye">{incident.title}</Link>
                <p className="mt-1 text-xs text-muted">{incident.id} - {incident.type}</p>
              </td>
              <td className="px-4 py-3"><StatusBadge tone={priorityTone(incident.priority)}>{humanPriority(incident.priority)}</StatusBadge></td>
              <td className="px-4 py-3"><VerificationStatusBadge score={incident.confidenceScore} status={incident.status} /></td>
              <td className="px-4 py-3"><StatusBadge tone={confidenceTone(incident.confidenceScore)}>{incident.confidenceScore}%</StatusBadge></td>
              <td className="px-4 py-3 text-muted">{incident.gps.lat}, {incident.gps.lng}<br />Accuracy {incident.gps.accuracy}</td>
              <td className="px-4 py-3 text-muted">{incident.reporterStatus}<br />{incident.reportingMode}</td>
              <td className="px-4 py-3 text-muted">{incident.assignedAgency}</td>
              <td className="px-4 py-3"><StatusBadge tone={incident.status === "Assigned" ? "warning" : "info"}>{incident.responseStatus}</StatusBadge></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export function IncidentDetail({
  incident,
  evidenceAccessLogs,
  timelineEntries,
  agencies,
  canLaunchDroneMission = false,
}: {
  incident: Incident;
  evidenceAccessLogs: EvidenceAccessEntry[];
  timelineEntries: ReportTimelineEntry[];
  agencies: AgencyView[];
  canLaunchDroneMission?: boolean;
}) {
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${incident.gps.lat},${incident.gps.lng}`;
  return (
    <div className="grid gap-5">
      <Panel title="Report summary" aside={<StatusBadge tone={priorityTone(incident.priority)}>{humanPriority(incident.priority)}</StatusBadge>}>
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0"><p className="text-xs font-semibold uppercase text-eye">{reportTypeLabel(incident.type)}</p><h2 className="mt-2 text-xl font-semibold text-ink">{incident.title}</h2><p className="mt-3 whitespace-pre-wrap break-words leading-7 text-muted">{incident.description || "No description was supplied with this report."}</p></div>
          <dl className="grid min-w-0 gap-x-5 gap-y-4 sm:grid-cols-2">
            <SummaryField label="Report type" value={reportTypeLabel(incident.type)} />
            <SummaryField label="Response status" value={incident.responseStatus} />
            <SummaryField label="Reporter" value={reportReporterLabel(incident)} />
            <SummaryField label="Captured" value={formatReportCapturedAt(incident.createdAt)} />
            <SummaryField label="Location" value={incident.location} />
            <SummaryField label="Assigned agency" value={incident.assignedAgency} />
            <SummaryField label="Verification status" value={verificationStatusFromScore(incident.confidenceScore, incident.status)} />
          </dl>
        </div>
      </Panel>

      <Panel title="Evidence" aside={<span className="text-xs font-semibold text-muted">{incident.evidence.length} item{incident.evidence.length === 1 ? "" : "s"}</span>}><ReportEvidenceGallery incidentId={incident.id} items={incident.evidence} /></Panel>

      <LocationTrailMap
        title="Report location"
        incidentId={incident.id}
        openLocationHref={mapsHref}
        locationLabel={incident.location}
        initialPoints={incident.locationHistory.length ? incident.locationHistory : [{ latitude: incident.gps.lat, longitude: incident.gps.lng, capturedAt: incident.createdAt ?? new Date(0).toISOString() }]}
      />
      <details className="rounded-lg border border-line bg-surface px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold text-ink">View exact coordinates</summary>
        <p className="mt-3 text-muted">Latitude {incident.gps.lat} · Longitude {incident.gps.lng} · Accuracy {incident.gps.accuracy}</p>
      </details>

      <Panel title="Admin operations">
        <div className="grid gap-3">
          <LaunchDroneMissionButton
            incidentId={incident.id}
            incidentTitle={incident.title}
            canLaunch={canLaunchDroneMission}
          />
          <IncidentAdminActions incidentId={incident.id} currentStatus={incident.status} agencies={agencies} />
        </div>
      </Panel>

      <ReportActivityPanels report={incident} entries={timelineEntries} evidenceAccessLogs={evidenceAccessLogs} />
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-line pb-3">
      <dt className="text-xs uppercase text-muted">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-ink">{value}</dd>
    </div>
  );
}
