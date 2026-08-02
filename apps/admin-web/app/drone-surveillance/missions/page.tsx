import { AppShell } from "../../../components/app-shell";
import { DroneSurveillanceSubnav } from "../../../components/drone/drone-surveillance-subnav";
import { DroneMissionTable } from "../../../components/drone/drone-mission-table";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDroneMissions } from "../../../lib/api/data";
import { canCommandDroneMission, canManageDroneFleet, canViewDroneSurveillance } from "../../../lib/drone-permissions";
import { getAdminSession } from "../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DroneActiveMissionsPage() {
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  const missions = await fetchDroneMissions().catch(() => []);
  const active = missions.filter((m) => ["Active", "Preflight", "Paused", "Scheduled"].includes(m.status));

  return (
    <AppShell>
      <PageHeader eyebrow="Drone Surveillance" title="Active drone missions" action={<StatusBadge tone="success">{active.length} open</StatusBadge>} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <Panel title="Mission queue">
        <DroneMissionTable missions={active} />
      </Panel>
    </AppShell>
  );
}
