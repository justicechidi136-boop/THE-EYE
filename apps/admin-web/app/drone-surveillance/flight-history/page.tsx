import { AppShell } from "../../../components/app-shell";
import { DroneMissionTable } from "../../../components/drone/drone-mission-table";
import { DroneSurveillanceSubnav } from "../../../components/drone/drone-surveillance-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDroneFlightHistory } from "../../../lib/api/data";
import { canCommandDroneMission, canManageDroneFleet, canViewDroneSurveillance } from "../../../lib/drone-permissions";
import { getAdminSession } from "../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DroneFlightHistoryPage() {
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  const missions = await fetchDroneFlightHistory().catch(() => []);

  return (
    <AppShell>
      <PageHeader eyebrow="Drone Surveillance" title="Flight history" action={<StatusBadge tone="neutral">{missions.length} completed</StatusBadge>} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <Panel title="Completed sorties">
        <DroneMissionTable missions={missions} />
      </Panel>
    </AppShell>
  );
}
