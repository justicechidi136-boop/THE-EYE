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

export default async function DroneOperatorQualificationsPage({ params }: PageProps) {
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
      <PageHeader eyebrow="Drone Surveillance" title={`${operator.name} qualifications`} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <DroneOperatorSubnav
        id={operator.id}
        canReadDocuments={canReadOperatorDocuments(session)}
        canReadSafety={canReadOperatorSafety(session)}
        canReadAudit={canReadOperatorAudit(session)}
      />
      <Panel title="Compliance and certifications">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div><dt className="text-muted">Certification level</dt><dd className="font-semibold">{operator.certificationLevel ?? "—"}</dd></div>
          <div><dt className="text-muted">Licence warning level</dt><dd className="font-semibold">{operator.licenceWarningLevel}</dd></div>
          <div><dt className="text-muted">Licence expiry</dt><dd className="font-semibold">{operator.complianceSummary.licenceExpiryAt ? new Date(operator.complianceSummary.licenceExpiryAt).toLocaleString() : "—"}</dd></div>
          <div><dt className="text-muted">Certificate expiry</dt><dd className="font-semibold">{operator.complianceSummary.certificateExpiryAt ? new Date(operator.complianceSummary.certificateExpiryAt).toLocaleString() : "—"}</dd></div>
          <div><dt className="text-muted">Medical expiry</dt><dd className="font-semibold">{operator.complianceSummary.medicalExpiryAt ? new Date(operator.complianceSummary.medicalExpiryAt).toLocaleString() : "—"}</dd></div>
        </dl>
      </Panel>
    </AppShell>
  );
}
