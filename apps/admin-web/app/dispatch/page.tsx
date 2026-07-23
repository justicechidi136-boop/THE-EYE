import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { CoordinatePanel, googleMapsUrl } from "../../components/dispatch/coordinate-panel";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { formatDuration } from "../../lib/dispatch/sla-display";
import { fetchDispatchIncidents, fetchDispatchResponders, type DispatchIncident, type DispatchResponder } from "../../lib/api/dispatch";

export const dynamic = "force-dynamic";

function incidentIsSilent(incident: DispatchIncident): boolean {
  const metadata = incident.metadata ?? {};
  return metadata.silent === true || metadata.emergencyCategory === "SilentSos";
}

function secondsSinceSubmitted(incident: DispatchIncident): number | null {
  if (!incident.submittedAt) return null;
  const submittedMs = Date.parse(incident.submittedAt);
  if (Number.isNaN(submittedMs)) return null;
  return Math.max(0, Math.floor((Date.now() - submittedMs) / 1000));
}

export default async function DispatchCommandCenterPage() {
  const [queue, responders] = await Promise.all([
    fetchDispatchIncidents({ unassignedOnly: "true" }),
    fetchDispatchResponders(),
  ]);

  const incidents: DispatchIncident[] = queue.data ?? [];
  const coordinateRows = incidents.map((incident) => ({
    id: incident.id,
    label: `${incident.priority} · ${incident.title}`,
    latitude: Number(incident.latitude),
    longitude: Number(incident.longitude),
    stale: incident.liveLocationStale,
    navigationUrl: googleMapsUrl(Number(incident.latitude), Number(incident.longitude)),
  }));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Dispatch"
        title="Emergency command center"
        action={<StatusBadge tone="danger">{incidents.length} unassigned</StatusBadge>}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Unassigned queue">
          <ul className="space-y-2">
            {incidents.map((incident) => (
              <li key={incident.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{incident.title}</span>
                  {incidentIsSilent(incident) ? (
                    <StatusBadge tone="warning">Silent SOS</StatusBadge>
                  ) : null}
                  {incident.liveLocationStale ? (
                    <StatusBadge tone="danger">Stale location</StatusBadge>
                  ) : null}
                </div>
                <div>
                  {incident.type} · {incident.status} · {incident.priority}
                </div>
                {secondsSinceSubmitted(incident) !== null ? (
                  <div className="text-xs text-muted-foreground">
                    Time since report: {formatDuration(secondsSinceSubmitted(incident)!)}
                  </div>
                ) : null}
                <Link className="text-primary underline" href={`/dispatch/incidents/${incident.id}`}>
                  Open incident detail
                </Link>
              </li>
            ))}
            {!incidents.length ? <p className="text-sm text-muted-foreground">No unassigned incidents in scope.</p> : null}
          </ul>
        </Panel>
        <Panel title="Live coordinates">
          <CoordinatePanel rows={coordinateRows} title="Incident positions" />
        </Panel>
        <Panel title="Responder availability">
          <ul className="space-y-2">
            {(responders.data ?? []).map((responder: DispatchResponder) => (
              <li key={responder.id} className="rounded-md border p-3 text-sm">
                <div className="font-medium">{responder.displayName}</div>
                <div>{responder.availability}</div>
              </li>
            ))}
            {!responders.data?.length ? <p className="text-sm text-muted-foreground">No responders in scope.</p> : null}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
