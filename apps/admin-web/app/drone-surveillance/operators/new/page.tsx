import { AppShell } from "../../../../components/app-shell";
import { DroneOperatorForm } from "../../../../components/drone/drone-operator-form";
import { DroneSurveillanceSubnav } from "../../../../components/drone/drone-surveillance-subnav";
import { PageHeader } from "../../../../components/ui";
import {
  canCommandDroneMission,
  canCreateDroneOperator,
  canManageDroneFleet,
  canReadDroneOperators,
  canViewDroneSurveillance,
} from "../../../../lib/drone-permissions";
import { getAdminSession } from "../../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewDroneOperatorPage() {
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  if (!canReadDroneOperators(session) || !canCreateDroneOperator(session)) redirect("/drone-surveillance/operators");

  return (
    <AppShell>
      <PageHeader eyebrow="Drone Surveillance" title="Add drone operator" />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <DroneOperatorForm mode="create" />
    </AppShell>
  );
}
