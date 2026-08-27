import Link from "next/link";
import type { EvidenceAccessEntry, Incident } from "../lib/types/admin-views";
import { verificationStatusFromScore } from "../lib/verification";
import { EmptyState, TableScrollHint } from "./form-primitives";
import { Panel, StatusBadge } from "./ui";
import { EvidenceAccessLog, VerificationStatusBadge } from "./verification-ui";
import { LocationTrailMap } from "./location-trail-map";
import { IncidentAdminActions } from "./incident-admin-actions";
import { EvidenceViewButton } from "./evidence-view-button";
import { AudioEvidencePlayer } from "./audio-evidence-player";
import { LaunchDroneMissionButton } from "./drone/launch-drone-mission-button";
import { humanPriority } from "../lib/admin-presentation";

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
  canLaunchDroneMission = false,
}: {
  incident: Incident;
  evidenceAccessLogs: EvidenceAccessEntry[];
  canLaunchDroneMission?: boolean;
}) {
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${incident.gps.lat},${incident.gps.lng}`;
  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Panel title="Incident summary" aside={<VerificationStatusBadge score={incident.confidenceScore} status={incident.status} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Priority level" value={humanPriority(incident.priority)} />
          <Field label="Response status" value={incident.responseStatus} />
          <Field label="GPS location" value={`${incident.gps.lat}, ${incident.gps.lng} (${incident.gps.accuracy})`} />
          <Field label="Reporter" value={incident.reporter.label} />
          {incident.reporter.accountReference ? <Field label="Account reference" value={incident.reporter.accountReference} /> : null}
          <Field label="Assigned agency" value={incident.assignedAgency} />
          <Field label="Location" value={incident.location} />
          <Field label="Verification status" value={verificationStatusFromScore(incident.confidenceScore, incident.status)} />
        </div>
        <p className="mt-5 leading-7 text-muted">{incident.description}</p>
      </Panel>
      <Panel title="Evidence">
        <div className="grid gap-3">
          {incident.evidence.length ? incident.evidence.map((item) => (
            <div key={item.id || item.hash} className="rounded-lg border border-line bg-surfaceMuted p-3">
              <p className="font-semibold">{item.type}: {item.name}</p>
              <p className="mt-1 break-all text-xs text-muted">{item.hash}</p>
              {item.type === "Audio" || item.contentType?.startsWith("audio/") ? (
                <AudioEvidencePlayer incidentId={incident.id} media={item} />
              ) : item.id ? (
                <EvidenceViewButton incidentId={incident.id} mediaId={item.id} label="View evidence" />
              ) : null}
            </div>
          )) : <p className="text-sm text-muted">No evidence uploaded yet.</p>}
        </div>
      </Panel>
      <Panel title="Admin operations">
        <div className="grid gap-3">
          <LaunchDroneMissionButton
            incidentId={incident.id}
            incidentTitle={incident.title}
            canLaunch={canLaunchDroneMission}
          />
          <IncidentAdminActions incidentId={incident.id} currentStatus={incident.status} />
        </div>
      </Panel>
      <Panel title="Status history">
        <ol className="grid gap-3">
          {incident.timeline.map((event) => (
            <li key={`${event.time}-${event.event}`} className="grid grid-cols-[58px_1fr] gap-3">
              <span className="text-sm font-semibold text-eye">{event.time}</span>
              <div>
                <p className="font-medium">{event.event}</p>
                <p className="text-sm text-muted">{event.actor}</p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel title="Evidence access logs">
        <EvidenceAccessLog entries={evidenceAccessLogs} />
      </Panel>
      <div className="xl:col-span-2">
        <LocationTrailMap
          title="Live map marker and movement trail"
          incidentId={incident.id}
          openLocationHref={mapsHref}
          locationLabel={incident.location}
          initialPoints={incident.locationHistory.length ? incident.locationHistory : [{ latitude: incident.gps.lat, longitude: incident.gps.lng, capturedAt: incident.createdAt ?? new Date(0).toISOString() }]}
        />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surfaceMuted p-3">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}
