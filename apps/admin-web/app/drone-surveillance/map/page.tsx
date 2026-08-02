import { AppShell } from "../../../components/app-shell";
import { DroneLiveMapPanel } from "../../../components/drone/drone-live-map-panel";
import { DroneSurveillanceSubnav } from "../../../components/drone/drone-surveillance-subnav";
import { DroneMissionTable } from "../../../components/drone/drone-mission-table";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDroneLiveGps } from "../../../lib/api/data";
import { canCommandDroneMission, canManageDroneFleet, canViewDroneSurveillance } from "../../../lib/drone-permissions";
import { getAdminSession } from "../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DroneLiveMapPage() {
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  const missions = await fetchDroneLiveGps().catch(() => []);

  return (
    <AppShell>
      <PageHeader eyebrow="Drone Surveillance" title="Live GPS map" action={<StatusBadge tone="info">{missions.length} tracked</StatusBadge>} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <div className="grid gap-5">
        <DroneLiveMapPanel missions={missions} />
        <Panel title="Tracked missions">
          <DroneMissionTable missions={missions} />
        </Panel>
      </div>
    </AppShell>
  );
}
