import Link from "next/link";
import { AppShell } from "../../../../components/app-shell";
import { DroneSurveillanceSubnav } from "../../../../components/drone/drone-surveillance-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../../components/ui";
import { fetchDroneMission } from "../../../../lib/api/data";
import { canCommandDroneMission, canManageDroneFleet, canViewDroneSurveillance } from "../../../../lib/drone-permissions";
import { getAdminSession } from "../../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DroneMissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  const mission = await fetchDroneMission(id);

  if (!mission) {
    return (
      <AppShell>
        <PageHeader eyebrow="Drone Surveillance" title="Mission not found" action={<StatusBadge tone="warning">Missing</StatusBadge>} />
      </AppShell>
    );
  }

  const mapsHref =
    mission.target != null
      ? `https://www.google.com/maps/search/?api=1&query=${mission.target.lat},${mission.target.lng}`
      : undefined;

  return (
    <AppShell>
      <PageHeader eyebrow={mission.missionCode} title={mission.title} action={<StatusBadge tone="info">{mission.status}</StatusBadge>} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Mission overview">
          <dl className="grid gap-3 text-sm">
            <div><dt className="text-muted">Priority</dt><dd className="font-semibold">{mission.priority}</dd></div>
            <div><dt className="text-muted">Drone</dt><dd className="font-semibold">{mission.drone?.deviceId ?? "Unassigned"}</dd></div>
            <div><dt className="text-muted">Live video</dt><dd className="font-semibold">{mission.liveVideoStatus}</dd></div>
            <div><dt className="text-muted">Target GPS</dt><dd className="font-semibold">{mission.target ? `${mission.target.lat}, ${mission.target.lng}` : "—"}</dd></div>
            {mapsHref ? (
              <a href={mapsHref} className="text-sm font-semibold text-eye hover:underline" target="_blank" rel="noreferrer">
                Open target in maps
              </a>
            ) : null}
          </dl>
          {mission.description ? <p className="mt-4 text-sm text-muted">{mission.description}</p> : null}
        </Panel>
        <Panel title="Incident linkage">
          {mission.incident ? (
            <div className="grid gap-2 text-sm">
              <Link href={`/incidents/${mission.incident.id}`} className="font-semibold text-eye hover:underline">
                {mission.incident.title}
              </Link>
              <p className="text-muted">Status: {mission.incident.status ?? "—"}</p>
              <Link href={`/drone-surveillance/map?incident=${mission.incident.id}`} className="text-eye hover:underline">
                View on live GPS map
              </Link>
            </div>
          ) : (
            <p className="text-sm text-muted">This mission is not linked to an incident.</p>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
