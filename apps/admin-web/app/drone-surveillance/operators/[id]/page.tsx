import Link from "next/link";
import { AppShell } from "../../../../components/app-shell";
import { DroneOperatorSubnav } from "../../../../components/drone/drone-operator-subnav";
import { DroneSurveillanceSubnav } from "../../../../components/drone/drone-surveillance-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../../components/ui";
import { fetchDroneOperator } from "../../../../lib/api/data";
import {
  canCommandDroneMission,
  canManageDroneFleet,
  canReadDroneOperators,
  canReadOperatorAudit,
  canReadOperatorDocuments,
  canReadOperatorSafety,
  canViewDroneSurveillance,
} from "../../../../lib/drone-permissions";
import { getAdminSession } from "../../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function DroneOperatorDetailPage({ params }: PageProps) {
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
      <PageHeader eyebrow="Drone Surveillance" title={operator.name} action={<StatusBadge tone="info">{operator.operatorCode ?? operator.callsign ?? "Operator"}</StatusBadge>} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <DroneOperatorSubnav
        id={operator.id}
        canReadDocuments={canReadOperatorDocuments(session)}
        canReadSafety={canReadOperatorSafety(session)}
        canReadAudit={canReadOperatorAudit(session)}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Identity">
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div><dt className="text-muted">Operator code</dt><dd className="font-semibold">{operator.operatorCode ?? "—"}</dd></div>
            <div><dt className="text-muted">Callsign</dt><dd className="font-semibold">{operator.callsign ?? "—"}</dd></div>
            <div><dt className="text-muted">Role</dt><dd className="font-semibold">{operator.operatorRole}</dd></div>
            <div><dt className="text-muted">Certification</dt><dd className="font-semibold">{operator.certificationLevel ?? "—"}</dd></div>
            <div><dt className="text-muted">Account</dt><dd className="font-semibold">{operator.accountStatus}</dd></div>
            <div><dt className="text-muted">Availability</dt><dd className="font-semibold">{operator.availabilityStatus}</dd></div>
            <div><dt className="text-muted">Email</dt><dd className="font-semibold">{operator.email ?? "—"}</dd></div>
            <div><dt className="text-muted">Phone</dt><dd className="font-semibold">{operator.phone ?? "—"}</dd></div>
            <div><dt className="text-muted">Location</dt><dd className="font-semibold">{[operator.lga, operator.state, operator.country].filter(Boolean).join(", ") || "—"}</dd></div>
            <div><dt className="text-muted">Operating base</dt><dd className="font-semibold">{operator.assignedOperatingBase ?? "—"}</dd></div>
          </dl>
        </Panel>

        <Panel title="Compliance summary">
          <dl className="grid gap-3 text-sm">
            <div><dt className="text-muted">Licence warning</dt><dd className="font-semibold">{operator.licenceWarningLevel}</dd></div>
            <div><dt className="text-muted">Licence expiry</dt><dd className="font-semibold">{operator.complianceSummary.licenceExpiryAt ? new Date(operator.complianceSummary.licenceExpiryAt).toLocaleString() : "—"}</dd></div>
            <div><dt className="text-muted">Certificate expiry</dt><dd className="font-semibold">{operator.complianceSummary.certificateExpiryAt ? new Date(operator.complianceSummary.certificateExpiryAt).toLocaleString() : "—"}</dd></div>
            <div><dt className="text-muted">Medical expiry</dt><dd className="font-semibold">{operator.complianceSummary.medicalExpiryAt ? new Date(operator.complianceSummary.medicalExpiryAt).toLocaleString() : "—"}</dd></div>
          </dl>
        </Panel>

        <Panel title="Mission stats">
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div><dt className="text-muted">Active assignments</dt><dd className="font-semibold">{operator.activeAssignmentCount}</dd></div>
            <div><dt className="text-muted">Total missions</dt><dd className="font-semibold">{operator.missionStats.totalMissions}</dd></div>
            <div><dt className="text-muted">Completed missions</dt><dd className="font-semibold">{operator.missionStats.completedMissions}</dd></div>
            <div><dt className="text-muted">Aborted missions</dt><dd className="font-semibold">{operator.missionStats.abortedMissions}</dd></div>
            <div><dt className="text-muted">Hours flown</dt><dd className="font-semibold">{operator.missionStats.hoursFlown}</dd></div>
          </dl>
        </Panel>

        <Panel title="Current assignment">
          {operator.currentAssignment ? (
            <div className="grid gap-2 text-sm">
              <p><span className="font-semibold">Mission:</span> {operator.currentAssignment.missionCode ?? operator.currentAssignment.missionId}</p>
              <p><span className="font-semibold">Status:</span> {operator.currentAssignment.status ?? "—"}</p>
              <Link href={`/drone-surveillance/missions/${operator.currentAssignment.missionId}`} className="font-semibold text-eye hover:underline">
                Open mission workspace
              </Link>
            </div>
          ) : (
            <p className="text-sm text-muted">No active mission assignment.</p>
          )}
        </Panel>

        <Panel title="Safety summary">
          <dl className="grid gap-3 text-sm">
            <div><dt className="text-muted">Incidents involved</dt><dd className="font-semibold">{operator.safetySummary.incidentsInvolved}</dd></div>
            <div><dt className="text-muted">Warnings</dt><dd className="font-semibold">{operator.safetySummary.warningCount}</dd></div>
            <div><dt className="text-muted">Last safety incident</dt><dd className="font-semibold">{operator.safetySummary.lastIncidentAt ? new Date(operator.safetySummary.lastIncidentAt).toLocaleString() : "—"}</dd></div>
          </dl>
        </Panel>
      </div>
    </AppShell>
  );
}
