import Link from "next/link";
import { AppShell } from "../../../../../components/app-shell";
import { DroneOperatorSubnav } from "../../../../../components/drone/drone-operator-subnav";
import { DroneSurveillanceSubnav } from "../../../../../components/drone/drone-surveillance-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../../../components/ui";
import { fetchDroneOperator } from "../../../../../lib/api/data";
import {
  canCommandDroneMission,
  canManageDroneFleet,
  canReadDroneOperators,
  canReadOperatorAudit,
  canReadOperatorDocuments,
  canReadOperatorSafety,
  canViewDroneSurveillance,
} from "../../../../../lib/drone-permissions";
import { getAdminSession } from "../../../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function DroneOperatorMissionsPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  if (!canReadDroneOperators(session)) redirect("/drone-surveillance");
  const operator = await fetchDroneOperator(id);

  if (!operator) {
    return (
      <AppShell>
        <PageHeader eyebrow="Drone Surveillance" title="Operator not found" action={<StatusBadge tone="warning">Missing</StatusBadge>} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader eyebrow="Drone Surveillance" title={`${operator.name} missions`} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <DroneOperatorSubnav
        id={operator.id}
        canReadDocuments={canReadOperatorDocuments(session)}
        canReadSafety={canReadOperatorSafety(session)}
        canReadAudit={canReadOperatorAudit(session)}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Mission statistics">
          <dl className="grid gap-3 text-sm">
            <div><dt className="text-muted">Total missions</dt><dd className="font-semibold">{operator.missionStats.totalMissions}</dd></div>
            <div><dt className="text-muted">Completed missions</dt><dd className="font-semibold">{operator.missionStats.completedMissions}</dd></div>
            <div><dt className="text-muted">Aborted missions</dt><dd className="font-semibold">{operator.missionStats.abortedMissions}</dd></div>
            <div><dt className="text-muted">Hours flown</dt><dd className="font-semibold">{operator.missionStats.hoursFlown}</dd></div>
            <div><dt className="text-muted">Active assignments</dt><dd className="font-semibold">{operator.activeAssignmentCount}</dd></div>
          </dl>
        </Panel>
        <Panel title="Current assignment">
          {operator.currentAssignment ? (
            <div className="grid gap-2 text-sm">
              <p><span className="font-semibold">Mission ID:</span> {operator.currentAssignment.missionId}</p>
              <p><span className="font-semibold">Mission code:</span> {operator.currentAssignment.missionCode ?? "—"}</p>
              <p><span className="font-semibold">Status:</span> {operator.currentAssignment.status ?? "—"}</p>
              <Link href={`/drone-surveillance/missions/${operator.currentAssignment.missionId}`} className="font-semibold text-eye hover:underline">
                Open mission details
              </Link>
            </div>
          ) : (
            <p className="text-sm text-muted">No mission is currently assigned.</p>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
