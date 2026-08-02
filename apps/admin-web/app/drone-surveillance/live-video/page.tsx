import { AppShell } from "../../../components/app-shell";
import { DroneSurveillanceSubnav } from "../../../components/drone/drone-surveillance-subnav";
import { DroneMissionTable } from "../../../components/drone/drone-mission-table";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDroneLiveVideoMissions } from "../../../lib/api/data";
import { canCommandDroneMission, canManageDroneFleet, canViewDroneSurveillance } from "../../../lib/drone-permissions";
import { getAdminSession } from "../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DroneLiveVideoPage() {
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  const missions = await fetchDroneLiveVideoMissions().catch(() => []);

  return (
    <AppShell>
      <PageHeader eyebrow="Drone Surveillance" title="Live video status" action={<StatusBadge tone="success">{missions.length} streams</StatusBadge>} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <Panel title="Broadcasting missions">
        <p className="mb-4 text-sm text-muted">Live video integrates with THE EYE LiveKit sessions when a mission elevates to aerial recording.</p>
        <DroneMissionTable missions={missions} />
      </Panel>
    </AppShell>
  );
}
