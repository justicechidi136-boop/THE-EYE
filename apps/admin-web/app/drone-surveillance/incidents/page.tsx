import { AppShell } from "../../../components/app-shell";
import { DroneMissionTable } from "../../../components/drone/drone-mission-table";
import { DroneSurveillanceSubnav } from "../../../components/drone/drone-surveillance-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDroneIncidentMissions } from "../../../lib/api/data";
import { canCommandDroneMission, canManageDroneFleet, canViewDroneSurveillance } from "../../../lib/drone-permissions";
import { getAdminSession } from "../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DroneIncidentMissionsPage() {
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  const missions = await fetchDroneIncidentMissions().catch(() => []);

  return (
    <AppShell>
      <PageHeader eyebrow="Drone Surveillance" title="Incident-linked missions" action={<StatusBadge tone="warning">{missions.length} linked</StatusBadge>} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <Panel title="Missions launched from incidents">
        <p className="mb-4 text-sm text-muted">Each mission inherits the incident GPS target and writes timeline + audit entries on launch.</p>
        <DroneMissionTable missions={missions} />
      </Panel>
    </AppShell>
  );
}
