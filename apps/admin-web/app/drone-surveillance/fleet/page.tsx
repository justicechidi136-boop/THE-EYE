import { AppShell } from "../../../components/app-shell";
import { DroneFleetTable } from "../../../components/drone/drone-fleet-table";
import { DroneSurveillanceSubnav } from "../../../components/drone/drone-surveillance-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDroneFleet } from "../../../lib/api/data";
import { canCommandDroneMission, canManageDroneFleet, canViewDroneSurveillance } from "../../../lib/drone-permissions";
import { getAdminSession } from "../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DroneFleetPage() {
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  const fleet = await fetchDroneFleet().catch(() => []);

  return (
    <AppShell>
      <PageHeader eyebrow="Drone Surveillance" title="Drone fleet management" action={<StatusBadge tone="info">{fleet.length} assets</StatusBadge>} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <Panel title="Registered drones">
        <DroneFleetTable devices={fleet} />
      </Panel>
    </AppShell>
  );
}
