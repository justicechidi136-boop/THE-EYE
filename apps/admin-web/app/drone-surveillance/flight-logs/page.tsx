import { AppShell } from "../../../components/app-shell";
import { DroneSurveillanceSubnav } from "../../../components/drone/drone-surveillance-subnav";
import { EmptyState, TableScrollHint } from "../../../components/form-primitives";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDroneFlightLogs } from "../../../lib/api/data";
import { canCommandDroneMission, canManageDroneFleet, canViewDroneSurveillance } from "../../../lib/drone-permissions";
import { getAdminSession } from "../../../lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DroneFlightLogsPage() {
  const session = await getAdminSession();
  if (!canViewDroneSurveillance(session)) redirect("/");
  const logs = await fetchDroneFlightLogs().catch(() => []);

  return (
    <AppShell>
      <PageHeader eyebrow="Drone Surveillance" title="Flight logs" action={<StatusBadge tone="neutral">{logs.length} events</StatusBadge>} />
      <DroneSurveillanceSubnav canManage={canManageDroneFleet(session)} canCommand={canCommandDroneMission(session)} />
      <Panel title="Telemetry and command log">
        {!logs.length ? (
          <EmptyState title="No flight log events" description="Preflight checks, status transitions, and telemetry anomalies are recorded here for audit." />
        ) : (
          <div>
            <TableScrollHint />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                  <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Drone</th><th className="px-4 py-3">Mission</th><th className="px-4 py-3">Event</th><th className="px-4 py-3">Message</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 text-muted">{log.recordedAt}</td>
                      <td className="px-4 py-3">{log.drone?.deviceId ?? "—"}</td>
                      <td className="px-4 py-3">{log.mission?.missionCode ?? "—"}</td>
                      <td className="px-4 py-3">{log.eventType}</td>
                      <td className="px-4 py-3">{log.message}</td>
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
