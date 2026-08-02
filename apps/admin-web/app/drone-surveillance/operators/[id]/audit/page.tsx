import { AppShell } from "../../../../../components/app-shell";
import { DroneOperatorSubnav } from "../../../../../components/drone/drone-operator-subnav";
import { DroneSurveillanceSubnav } from "../../../../../components/drone/drone-surveillance-subnav";
import { EmptyState } from "../../../../../components/form-primitives";
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

export default async function DroneOperatorAuditPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  if (!canReadDroneOperators(session)) redirect("/drone-surveillance");
  if (!canReadOperatorAudit(session)) redirect(`/drone-surveillance/operators/${id}`);
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
      <PageHeader eyebrow="Drone Surveillance" title={`${operator.name} audit log`} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <DroneOperatorSubnav
        id={operator.id}
        canReadDocuments={canReadOperatorDocuments(session)}
        canReadSafety={canReadOperatorSafety(session)}
        canReadAudit={canReadOperatorAudit(session)}
      />
      <Panel title="Operator audit events">
        {!operator.auditEntries.length ? (
          <EmptyState title="No audit entries found" description="No operator updates have been recorded in the selected period." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Event ID</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {operator.auditEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 font-mono text-xs">{entry.id}</td>
                    <td className="px-4 py-3">{entry.action}</td>
                    <td className="px-4 py-3">{entry.actor}</td>
                    <td className="px-4 py-3">{new Date(entry.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
