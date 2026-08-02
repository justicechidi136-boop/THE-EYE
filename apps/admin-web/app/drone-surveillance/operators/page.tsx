import { AppShell } from "../../../components/app-shell";
import { DroneSurveillanceSubnav } from "../../../components/drone/drone-surveillance-subnav";
import { EmptyState, TableScrollHint } from "../../../components/form-primitives";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDroneOperators } from "../../../lib/api/data";
import { canCommandDroneMission, canManageDroneFleet, canViewDroneSurveillance } from "../../../lib/drone-permissions";
import { getAdminSession } from "../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DroneOperatorsPage() {
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  const operators = await fetchDroneOperators().catch(() => []);

  return (
    <AppShell>
      <PageHeader eyebrow="Drone Surveillance" title="Drone operator management" action={<StatusBadge tone="info">{operators.length} operators</StatusBadge>} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <Panel title="Certified operators">
        {!operators.length ? (
          <EmptyState title="No operators registered" description="Add Drone Commanders and Drone Operators with certification level and callsign." />
        ) : (
          <div>
            <TableScrollHint />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                  <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Callsign</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Certification</th><th className="px-4 py-3">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {operators.map((operator) => (
                    <tr key={operator.id}>
                      <td className="px-4 py-3 font-semibold">{operator.name}<p className="text-xs text-muted">{operator.email ?? "—"}</p></td>
                      <td className="px-4 py-3">{operator.callsign ?? "—"}</td>
                      <td className="px-4 py-3">{operator.operatorRole}</td>
                      <td className="px-4 py-3">{operator.certificationLevel ?? "—"}</td>
                      <td className="px-4 py-3">{operator.isActive ? "Active" : "Inactive"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
