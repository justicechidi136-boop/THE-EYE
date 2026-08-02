import { AppShell } from "../../../components/app-shell";
import { DroneMissionTable } from "../../../components/drone/drone-mission-table";
import { DroneSurveillanceSubnav } from "../../../components/drone/drone-surveillance-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDroneMissions } from "../../../lib/api/data";
import { canCommandDroneMission, canManageDroneFleet, canViewDroneSurveillance } from "../../../lib/drone-permissions";
import { getAdminSession } from "../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DroneSchedulingPage() {
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  const missions = await fetchDroneMissions("Scheduled").catch(() => []);

  return (
    <AppShell>
      <PageHeader eyebrow="Drone Surveillance" title="Mission scheduling" action={<StatusBadge tone="info">{missions.length} scheduled</StatusBadge>} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <Panel title="Scheduled sorties">
        <p className="mb-4 text-sm text-muted">Plan patrol windows, incident standby coverage, and recurring aerial surveys.</p>
        <DroneMissionTable missions={missions} />
      </Panel>
    </AppShell>
  );
}
