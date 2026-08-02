import { AppShell } from "../../../components/app-shell";
import { DroneSurveillanceSubnav } from "../../../components/drone/drone-surveillance-subnav";
import { EmptyState, TableScrollHint } from "../../../components/form-primitives";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDroneHealth } from "../../../lib/api/data";
import { canCommandDroneMission, canManageDroneFleet, canViewDroneSurveillance } from "../../../lib/drone-permissions";
import { getAdminSession } from "../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DroneHealthPage() {
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  const rows = await fetchDroneHealth().catch(() => []);

  return (
    <AppShell>
      <PageHeader eyebrow="Drone Surveillance" title="Battery and health monitoring" action={<StatusBadge tone="success">{rows.length} monitored</StatusBadge>} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <Panel title="Fleet health snapshots">
        {!rows.length ? (
          <EmptyState title="No health telemetry yet" description="Battery, motor, and GPS fix snapshots appear after drones connect to THE EYE telemetry." />
        ) : (
          <div>
            <TableScrollHint />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                  <tr><th className="px-4 py-3">Drone</th><th className="px-4 py-3">Health</th><th className="px-4 py-3">Battery</th><th className="px-4 py-3">Motor</th><th className="px-4 py-3">GPS fix</th><th className="px-4 py-3">Last seen</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-semibold">{row.deviceId}</td>
                      <td className="px-4 py-3">{row.healthStatus}</td>
                      <td className="px-4 py-3">{row.batteryLevel != null ? `${row.batteryLevel}%` : row.latestHealth?.batteryLevel != null ? `${row.latestHealth.batteryLevel}%` : "—"}</td>
                      <td className="px-4 py-3">{String(row.latestHealth?.motorStatus ?? "—")}</td>
                      <td className="px-4 py-3">{String(row.latestHealth?.gpsFix ?? "—")}</td>
                      <td className="px-4 py-3 text-muted">{row.lastSeenAt ?? "—"}</td>
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
