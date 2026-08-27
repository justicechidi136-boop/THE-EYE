import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "../../../../components/app-shell";
import { AssignmentActions } from "../../../../components/dispatch/assignment-actions";
import { CoordinatePanel, googleMapsUrl } from "../../../../components/dispatch/coordinate-panel";
import { DispatchActions } from "../../../../components/dispatch/dispatch-actions";
import { IncidentSlaPanel } from "../../../../components/dispatch/incident-sla-panel";
import { IncidentTimelinePanel } from "../../../../components/dispatch/incident-timeline-panel";
import { IncidentCommunicationPanel } from "../../../../components/dispatch/incident-communication-panel";
import { ConsolePageHeader } from "../../../../components/console";
import { Panel, StatusBadge } from "../../../../components/ui";
import { getRouteById } from "../../../../lib/admin/admin-route-registry";
import {
  fetchAssignmentLiveLocation,
  fetchCitizenLiveLocation,
  fetchDispatchIncident,
  fetchDispatchIncidentTimeline,
  fetchDispatchResponders,
} from "../../../../lib/api/dispatch";
import { fetchIncident as fetchIncidentEvidence } from "../../../../lib/api/data";
import { humanPriority } from "../../../../lib/admin-presentation";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function DispatchIncidentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const route = getRouteById("emergency-command");
  const [detail, timeline, responders, citizenLive, incidentEvidence] = await Promise.all([
    fetchDispatchIncident(id),
    fetchDispatchIncidentTimeline(id),
    fetchDispatchResponders(),
    fetchCitizenLiveLocation(id),
    fetchIncidentEvidence(id),
  ]);

  if (!detail?.data) notFound();

  const incident = detail.data.incident;
  const assignment = detail.data.assignments?.[0];
  const triage = detail.data.triage as Record<string, unknown> | undefined;
  const routing = Array.isArray(detail.data.routingRecommendations) ? detail.data.routingRecommendations : [];
  const citizenData = citizenLive?.data ?? null;
  const responderData = assignment?.id
    ? (await fetchAssignmentLiveLocation(assignment.id))?.data ?? null
    : null;

  return (
    <AppShell>
      <ConsolePageHeader
        title={incident.title}
        eyebrow="Dispatch incident workspace"
        breadcrumbs={[...(route?.breadcrumb ?? ["Dispatch"]), incident.id.slice(0, 8)]}
        action={
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="info">{incident.status}</StatusBadge>
            <StatusBadge tone="warning">{humanPriority(String(incident.priority))}</StatusBadge>
            {detail.data.silentIndicator ? <StatusBadge tone="danger">Silent SOS</StatusBadge> : null}
          </div>
        }
      />
      <p className="mb-4 text-sm text-muted">
        <Link className="underline" href="/dispatch">
          Back to command center
        </Link>
        {" · "}
        <Link className="underline" href={`/incidents/${incident.id}`}>
          Open incident centre record
        </Link>
      </p>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="grid min-w-0 gap-5">
          <Panel title="Incident summary">
            <dl className="grid gap-2 text-sm">
              <div><dt className="text-muted">Category</dt><dd>{incident.type}</dd></div>
              <div><dt className="text-muted">Verification</dt><dd>{incident.verificationStatus ?? "Pending"}</dd></div>
              <div><dt className="text-muted">Reporter mode</dt><dd>{incident.metadata?.anonymous ? "Protected" : "Identified where permitted"}</dd></div>
              <div><dt className="text-muted">Jurisdiction</dt><dd>{[incident.lga, incident.state, incident.country].filter(Boolean).join(", ")}</dd></div>
              <div><dt className="text-muted">Triage rationale</dt><dd>{Array.isArray(triage?.rationale) ? (triage?.rationale as string[]).join(" ") : "Automatic triage"}</dd></div>
              <div><dt className="text-muted">Recommended agencies</dt><dd>{Array.isArray(triage?.suggestedAgencyTypes) ? (triage?.suggestedAgencyTypes as string[]).join(", ") : "Pending routing"}</dd></div>
            </dl>
          </Panel>
          <Panel title="Live coordinates">
            <CoordinatePanel
              rows={[
                {
                  id: `${incident.id}-citizen`,
                  label: "Citizen location",
                  latitude: Number(citizenData?.latitude ?? incident.latitude),
                  longitude: Number(citizenData?.longitude ?? incident.longitude),
                  stale: Boolean(citizenData?.stale ?? incident.liveLocationStale),
                  navigationUrl: googleMapsUrl(
                    Number(citizenData?.latitude ?? incident.latitude),
                    Number(citizenData?.longitude ?? incident.longitude),
                  ),
                },
                ...(responderData
                  ? [
                      {
                        id: `${incident.id}-responder`,
                        label: "Responder location",
                        latitude: Number(responderData.latitude),
                        longitude: Number(responderData.longitude),
                        stale: Boolean(responderData.stale),
                        navigationUrl: googleMapsUrl(Number(responderData.latitude), Number(responderData.longitude)),
                      },
                    ]
                  : []),
              ]}
              title="Citizen and responder positions"
            />
          </Panel>
          <Panel title="Evidence">
            {incidentEvidence?.evidence?.length ? (
              <ul className="grid gap-2 text-sm">
                {incidentEvidence.evidence.map((item) => (
                  <li key={item.id} className="rounded-md border border-line px-3 py-2">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-muted">{item.type} · {item.hash.slice(0, 12)}…</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No evidence attached or outside current scope.</p>
            )}
          </Panel>
          <div className="xl:col-span-2">
            <IncidentTimelinePanel incidentId={incident.id} entries={(timeline.data ?? []) as Array<{ at?: string; type?: string; label?: string; silent?: boolean }>} />
          </div>
          <div className="xl:col-span-2">
            <IncidentCommunicationPanel incidentId={incident.id} />
          </div>
        </div>

        <div className="grid min-w-0 gap-5">
          <IncidentSlaPanel
            sla={detail.data.slaTimers}
            citizenLocationStale={Boolean(citizenData?.stale ?? incident.liveLocationStale)}
            responderLocationStale={Boolean(responderData?.stale)}
            citizenLocationUpdatedAt={(citizenData?.capturedAt as string | undefined) ?? incident.liveLocationUpdatedAt ?? null}
            responderLocationUpdatedAt={responderData?.capturedAt as string | undefined}
          />
          <Panel title="Assignment list">
            {assignment ? (
              <dl className="grid gap-2 text-sm">
                <div><dt className="text-muted">Status</dt><dd>{assignment.status} · v{assignment.version}</dd></div>
                <div><dt className="text-muted">Responder / unit</dt><dd>{assignment.responder?.displayName ?? assignment.agency?.name ?? "None"}</dd></div>
                <div><dt className="text-muted">ETA source</dt><dd>{detail.data.distanceSource ?? "haversine"} (road ETA unavailable)</dd></div>
              </dl>
            ) : (
              <p className="text-sm text-muted">Unassigned — use command actions to assign a responder.</p>
            )}
          </Panel>
          <Panel title="Agency recommendations">
            {routing.length ? (
              <ul className="grid gap-2 text-sm">
                {routing.slice(0, 5).map((entry, index) => {
                  const row = entry as Record<string, unknown>;
                  return (
                    <li key={String(row.agencyId ?? index)} className="rounded-md border border-line px-3 py-2">
                      <p className="font-semibold">{String(row.name ?? row.agencyType ?? "Agency")}</p>
                      <p className="text-muted">Rank {String(row.rank ?? index + 1)} · {String(row.distanceKm ?? "—")} km (haversine)</p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">No routing recommendations returned for this incident.</p>
            )}
          </Panel>
          <Panel title="Communication status">
            <dl className="grid gap-2 text-sm">
              <div><dt className="text-muted">Incident thread</dt><dd>Reporter/dispatcher secure messaging panel above</dd></div>
              <div><dt className="text-muted">Live video</dt><dd>Unavailable until LiveKit admin viewer is configured</dd></div>
              <div><dt className="text-muted">Notifications</dt><dd>Push routes to Active Emergency messages (no message body in payload)</dd></div>
            </dl>
          </Panel>
          <Panel title="Command actions">
            <DispatchActions
              incidentId={incident.id}
              responders={responders.data ?? []}
              assignmentVersion={assignment?.version ?? null}
            />
          </Panel>
          {assignment ? (
            <Panel title="Assignment follow-up">
              <AssignmentActions
                assignmentId={assignment.id}
                assignmentVersion={assignment.version}
                assignmentStatus={assignment.status}
              />
            </Panel>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
