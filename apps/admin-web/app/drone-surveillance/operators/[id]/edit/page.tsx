import { AppShell } from "../../../../../components/app-shell";
import { DroneOperatorForm } from "../../../../../components/drone/drone-operator-form";
import { DroneOperatorSubnav } from "../../../../../components/drone/drone-operator-subnav";
import { DroneSurveillanceSubnav } from "../../../../../components/drone/drone-surveillance-subnav";
import { PageHeader, StatusBadge } from "../../../../../components/ui";
import { fetchDroneOperator } from "../../../../../lib/api/data";
import {
  canCommandDroneMission,
  canManageDroneFleet,
  canReadDroneOperators,
  canReadOperatorAudit,
  canReadOperatorDocuments,
  canReadOperatorSafety,
  canUpdateDroneOperator,
  canViewDroneSurveillance,
} from "../../../../../lib/drone-permissions";
import { getAdminSession } from "../../../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditDroneOperatorPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  if (!canReadDroneOperators(session) || !canUpdateDroneOperator(session)) redirect(`/drone-surveillance/operators/${id}`);
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
      <PageHeader eyebrow="Drone Surveillance" title={`Edit ${operator.name}`} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <DroneOperatorSubnav
        id={operator.id}
        canReadDocuments={canReadOperatorDocuments(session)}
        canReadSafety={canReadOperatorSafety(session)}
        canReadAudit={canReadOperatorAudit(session)}
      />
      <DroneOperatorForm
        mode="edit"
        operatorId={operator.id}
        initialValues={{
          name: operator.name,
          email: operator.email ?? "",
          phone: operator.phone ?? "",
          callsign: operator.callsign ?? "",
          operatorCode: operator.operatorCode ?? "",
          operatorRole: operator.operatorRole,
          certificationLevel: operator.certificationLevel ?? "",
          accountStatus: operator.accountStatus,
          availabilityStatus: operator.availabilityStatus,
          country: operator.country ?? "",
          state: operator.state ?? "",
          lga: operator.lga ?? "",
          assignedOperatingBase: operator.assignedOperatingBase ?? "",
          isActive: operator.isActive,
        }}
      />
    </AppShell>
  );
}
