import { AppShell } from "../../../components/app-shell";
import { DroneSurveillanceSubnav } from "../../../components/drone/drone-surveillance-subnav";
import { EmptyState, TableScrollHint } from "../../../components/form-primitives";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDroneNoFlyZones } from "../../../lib/api/data";
import { canCommandDroneMission, canManageDroneFleet, canViewDroneSurveillance } from "../../../lib/drone-permissions";
import { getAdminSession } from "../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DroneNoFlyZonesPage() {
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  const zones = await fetchDroneNoFlyZones().catch(() => []);

  return (
    <AppShell>
      <PageHeader eyebrow="Drone Surveillance" title="No-fly zones" action={<StatusBadge tone="warning">{zones.length} restricted</StatusBadge>} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <Panel title="Restricted airspace">
        {!zones.length ? (
          <EmptyState title="No no-fly zones defined" description="Register airports, government facilities, and temporary restriction polygons to block autonomous routing." />
        ) : (
          <div>
            <TableScrollHint />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                  <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {zones.map((zone) => (
                    <tr key={zone.id}>
                      <td className="px-4 py-3 font-semibold">{zone.name}</td>
                      <td className="px-4 py-3 text-muted">{zone.reason ?? "—"}</td>
                      <td className="px-4 py-3">{zone.isActive ? "Active" : "Inactive"}</td>
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
