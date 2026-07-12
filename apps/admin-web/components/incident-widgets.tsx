import Link from "next/link";
import type { EvidenceAccessEntry, Incident } from "../lib/types/admin-views";
import { verificationStatusFromScore } from "../lib/verification";
import { EmptyState, TableScrollHint } from "./form-primitives";
import { EvidenceAccessLog, VerificationStatusBadge } from "./verification-ui";
import { LocationTrailMap } from "./location-trail-map";
import { Panel, StatusBadge } from "./ui";

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
  return (
    <Panel title="Live incident map" aside={<span className="text-xs text-muted">PostGIS feed ready</span>}>
      <div
        className="leaflet-grid relative min-h-[420px] overflow-hidden rounded-lg border border-line"
        role="img"
        aria-label={`Operational map showing ${incidents.length} incident positions in Ikeja`}
      >
        <div className="absolute left-[58%] top-[38%] h-4 w-4 rounded-full bg-red-600 ring-4 ring-red-600/20" />
        <div className="absolute left-[48%] top-[52%] h-4 w-4 rounded-full bg-amber-500 ring-4 ring-amber-500/20" />
        <div className="absolute left-[65%] top-[61%] h-4 w-4 rounded-full bg-sky-600 ring-4 ring-sky-600/20" />
        <div className="absolute bottom-4 left-4 rounded-lg border border-line bg-surface/95 p-3 shadow-soft">
          <p className="text-sm font-semibold">Ikeja operational view</p>
          <p className="mt-1 text-xs text-muted">GPS, manual adjustment, assigned agency, and confidence overlays.</p>
        </div>
        <div className="absolute right-4 top-4 grid gap-2 rounded-lg border border-line bg-surface/95 p-3 text-xs shadow-soft">
          {incidents.map((incident) => (
            <div key={incident.id} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-eye" />
              <span>{incident.id} - {incident.gps.lat.toFixed(4)}, {incident.gps.lng.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
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
              <td className="px-4 py-3"><StatusBadge tone={priorityTone(incident.priority)}>{incident.priority}</StatusBadge></td>
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
}: {
  incident: Incident;
  evidenceAccessLogs: EvidenceAccessEntry[];
}) {
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${incident.gps.lat},${incident.gps.lng}`;
  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Panel title="Incident summary" aside={<VerificationStatusBadge score={incident.confidenceScore} status={incident.status} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Priority level" value={incident.priority} />
          <Field label="Response status" value={incident.responseStatus} />
          <Field label="GPS location" value={`${incident.gps.lat}, ${incident.gps.lng} (${incident.gps.accuracy})`} />
          <Field label="Reporter status" value={`${incident.reporterStatus} - ${incident.reportingMode}`} />
          <Field label="Assigned agency" value={incident.assignedAgency} />
          <Field label="Location" value={incident.location} />
          <Field label="Verification status" value={verificationStatusFromScore(incident.confidenceScore, incident.status)} />
        </div>
        <p className="mt-5 leading-7 text-muted">{incident.description}</p>
      </Panel>
      <Panel title="Evidence">
        <div className="grid gap-3">
          {incident.evidence.length ? incident.evidence.map((item) => (
            <div key={item.hash} className="rounded-lg border border-line bg-surfaceMuted p-3">
              <p className="font-semibold">{item.type}: {item.name}</p>
              <p className="mt-1 break-all text-xs text-muted">{item.hash}</p>
            </div>
          )) : <p className="text-sm text-muted">No evidence uploaded yet.</p>}
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
        <LocationTrailMap title="Live map marker and movement trail" openLocationHref={mapsHref} />
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
