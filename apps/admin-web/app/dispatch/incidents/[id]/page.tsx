import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "../../../../components/app-shell";
import { CoordinatePanel, googleMapsUrl } from "../../../../components/dispatch/coordinate-panel";
import { DispatchActions } from "../../../../components/dispatch/dispatch-actions";
import { IncidentSlaPanel } from "../../../../components/dispatch/incident-sla-panel";
import { IncidentTimelinePanel } from "../../../../components/dispatch/incident-timeline-panel";
import { PageHeader, Panel, StatusBadge } from "../../../../components/ui";
import {
  fetchAssignmentLiveLocation,
  fetchCitizenLiveLocation,
  fetchDispatchIncident,
  fetchDispatchIncidentTimeline,
  fetchDispatchResponders,
} from "../../../../lib/api/dispatch";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function DispatchIncidentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [detail, timeline, responders, citizenLive, assignmentLive] = await Promise.all([
    fetchDispatchIncident(id),
    fetchDispatchIncidentTimeline(id),
    fetchDispatchResponders(),
    fetchCitizenLiveLocation(id),
    fetchDispatchIncident(id).then(async (payload) => {
      const assignmentId = payload?.data.assignments?.[0]?.id;
      if (!assignmentId) return null;
      return fetchAssignmentLiveLocation(assignmentId);
    }),
  ]);

  if (!detail?.data) notFound();

  const incident = detail.data.incident;
  const assignment = detail.data.assignments?.[0];
  const triage = detail.data.triage as Record<string, unknown> | undefined;
  const citizenData = citizenLive?.data ?? null;
  const responderData = assignmentLive?.data ?? null;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Dispatch incident"
        title={incident.title}
        action={
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="info">{incident.status}</StatusBadge>
            <StatusBadge tone="warning">{incident.priority}</StatusBadge>
            {detail.data.silentIndicator ? <StatusBadge tone="danger">Silent SOS</StatusBadge> : null}
          </div>
        }
      />
      <p className="mb-4 text-sm text-muted-foreground">
        <Link className="underline" href="/dispatch">
          Back to command center
        </Link>
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Operational summary">
          <dl className="grid gap-2 text-sm">
            <div><dt className="text-muted-foreground">Category</dt><dd>{incident.type}</dd></div>
            <div><dt className="text-muted-foreground">Verification</dt><dd>{incident.verificationStatus ?? "Pending"}</dd></div>
            <div><dt className="text-muted-foreground">Operational state</dt><dd>{incident.status}</dd></div>
            <div><dt className="text-muted-foreground">Triage rationale</dt><dd>{Array.isArray(triage?.rationale) ? (triage?.rationale as string[]).join(" ") : "Automatic triage"}</dd></div>
            <div><dt className="text-muted-foreground">Recommended agencies</dt><dd>{Array.isArray(triage?.suggestedAgencyTypes) ? (triage?.suggestedAgencyTypes as string[]).join(", ") : "Pending routing"}</dd></div>
            <div><dt className="text-muted-foreground">Assignment</dt><dd>{assignment ? `${assignment.status} · v${assignment.version}` : "Unassigned"}</dd></div>
            <div><dt className="text-muted-foreground">Responder / unit</dt><dd>{assignment?.responder?.displayName ?? assignment?.agency?.name ?? "None"}</dd></div>
            <div><dt className="text-muted-foreground">ETA source</dt><dd>{detail.data.distanceSource ?? "haversine"}</dd></div>
            <div><dt className="text-muted-foreground">Evidence summary</dt><dd>{Array.isArray(incident.metadata?.mediaCount) ? String(incident.metadata?.mediaCount) : "See incident media"}</dd></div>
          </dl>
        </Panel>
        <IncidentSlaPanel
          sla={detail.data.slaTimers}
          citizenLocationStale={Boolean(citizenData?.stale ?? incident.liveLocationStale)}
          responderLocationStale={Boolean(responderData?.stale)}
          citizenLocationUpdatedAt={(citizenData?.capturedAt as string | undefined) ?? incident.liveLocationUpdatedAt ?? null}
          responderLocationUpdatedAt={responderData?.capturedAt as string | undefined}
        />
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
        <Panel title="Command actions">
          <DispatchActions
            incidentId={incident.id}
            responders={responders.data ?? []}
            assignmentVersion={assignment?.version ?? null}
          />
        </Panel>
        <div className="lg:col-span-2">
          <IncidentTimelinePanel entries={(timeline.data ?? []) as Array<{ at?: string; type?: string; label?: string; silent?: boolean }>} />
        </div>
      </div>
    </AppShell>
  );
}
