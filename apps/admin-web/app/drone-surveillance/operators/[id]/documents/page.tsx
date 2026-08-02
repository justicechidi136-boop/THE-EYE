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

export default async function DroneOperatorDocumentsPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  if (!canReadDroneOperators(session)) redirect("/drone-surveillance");
  if (!canReadOperatorDocuments(session)) redirect(`/drone-surveillance/operators/${id}`);
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
      <PageHeader eyebrow="Drone Surveillance" title={`${operator.name} documents`} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <DroneOperatorSubnav
        id={operator.id}
        canReadDocuments={canReadOperatorDocuments(session)}
        canReadSafety={canReadOperatorSafety(session)}
        canReadAudit={canReadOperatorAudit(session)}
      />
      <Panel title="Document registry">
        {!operator.documents.length ? (
          <EmptyState title="No operator documents found" description="No licence, medical, or certification documents have been linked yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Document ID</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {operator.documents.map((document) => (
                  <tr key={document.id}>
                    <td className="px-4 py-3 font-mono text-xs">{document.id}</td>
                    <td className="px-4 py-3">{document.type}</td>
                    <td className="px-4 py-3">{document.status}</td>
                    <td className="px-4 py-3">{document.expiresAt ? new Date(document.expiresAt).toLocaleString() : "—"}</td>
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
