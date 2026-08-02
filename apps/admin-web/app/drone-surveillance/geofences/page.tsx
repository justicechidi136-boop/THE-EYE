import { AppShell } from "../../../components/app-shell";
import { DroneSurveillanceSubnav } from "../../../components/drone/drone-surveillance-subnav";
import { EmptyState, TableScrollHint } from "../../../components/form-primitives";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDroneGeofences } from "../../../lib/api/data";
import { canCommandDroneMission, canManageDroneFleet, canViewDroneSurveillance } from "../../../lib/drone-permissions";
import { getAdminSession } from "../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DroneGeofencesPage() {
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  const geofences = await fetchDroneGeofences().catch(() => []);

  return (
    <AppShell>
      <PageHeader eyebrow="Drone Surveillance" title="Geofence management" action={<StatusBadge tone="info">{geofences.length} zones</StatusBadge>} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <Panel title="Operational geofences">
        {!geofences.length ? (
          <EmptyState title="No geofences configured" description="Define operational boundaries, incident perimeters, and restricted patrol corridors." />
        ) : (
          <div>
            <TableScrollHint />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                  <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {geofences.map((zone) => (
                    <tr key={zone.id}>
                      <td className="px-4 py-3 font-semibold">{zone.name}</td>
                      <td className="px-4 py-3">{zone.fenceType}</td>
                      <td className="px-4 py-3 text-muted">{zone.description ?? "—"}</td>
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
