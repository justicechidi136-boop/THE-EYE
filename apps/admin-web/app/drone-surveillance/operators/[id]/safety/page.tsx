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

export default async function DroneOperatorSafetyPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  if (!canReadDroneOperators(session)) redirect("/drone-surveillance");
  if (!canReadOperatorSafety(session)) redirect(`/drone-surveillance/operators/${id}`);
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
      <PageHeader eyebrow="Drone Surveillance" title={`${operator.name} safety`} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <DroneOperatorSubnav
        id={operator.id}
        canReadDocuments={canReadOperatorDocuments(session)}
        canReadSafety={canReadOperatorSafety(session)}
        canReadAudit={canReadOperatorAudit(session)}
      />
      <Panel title="Safety posture">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div><dt className="text-muted">Incidents involved</dt><dd className="font-semibold">{operator.safetySummary.incidentsInvolved}</dd></div>
          <div><dt className="text-muted">Warnings</dt><dd className="font-semibold">{operator.safetySummary.warningCount}</dd></div>
          <div><dt className="text-muted">Last incident date</dt><dd className="font-semibold">{operator.safetySummary.lastIncidentAt ? new Date(operator.safetySummary.lastIncidentAt).toLocaleString() : "—"}</dd></div>
          <div><dt className="text-muted">Availability</dt><dd className="font-semibold">{operator.availabilityStatus}</dd></div>
        </dl>
      </Panel>
    </AppShell>
  );
}
