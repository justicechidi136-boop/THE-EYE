import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchFieldOperationsMonitoring } from "../../../lib/api/data";
import { canManageFieldDevices } from "../../../lib/field-device-permissions";
import { getAdminSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export default async function FieldOperationsMonitoringPage({
  searchParams,
}: {
  searchParams: Promise<{ agencyId?: string }>;
}) {
  const params = await searchParams;
  const session = await getAdminSession();
  const canManage = canManageFieldDevices(session);
  const summary = canManage ? await fetchFieldOperationsMonitoring({ agencyId: params.agencyId }) : null;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Field Operations"
        title="Operational monitoring"
        action={
          summary ? (
            <StatusBadge tone="info">
              {summary.counts.activePatrols} patrols · {summary.counts.activeCheckpoints} checkpoints
            </StatusBadge>
          ) : null
        }
      />
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <Link href="/field-operations/monitoring" className="rounded border border-line px-3 py-1 hover:border-eye">
          Monitoring
        </Link>
        <Link href="/field-operations/devices" className="rounded border border-line px-3 py-1 hover:border-eye">
          Field tablets
        </Link>
      </div>

      {!canManage ? (
        <Panel title="Access restricted">
          <p className="text-sm text-muted">Your role cannot view field operations monitoring.</p>
        </Panel>
      ) : null}

      {summary ? (
        <>
          <div className="mb-5 grid gap-4 md:grid-cols-4">
            {(
              [
                ["Active shifts", summary.counts.activeShifts],
                ["Active patrols", summary.counts.activePatrols],
                ["Active checkpoints", summary.counts.activeCheckpoints],
                ["Offline officers", summary.counts.offlineOfficers],
                ["Open backup", summary.counts.openBackupRequests ?? 0],
                ["Safety alerts", summary.counts.activeSafetyAlerts ?? 0],
                ["Sync backlog", summary.counts.syncBacklog ?? 0],
                ["Revoked devices", summary.counts.revokedOrLostDevices ?? 0],
              ] as const
            ).map(([label, value]) => (
              <Panel key={label} title={label}>
                <p className="text-3xl font-semibold">{value}</p>
              </Panel>
            ))}
          </div>

          <Panel title="Officer status">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3">Officer</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Battery</th>
                    <th className="px-4 py-3">GPS</th>
                    <th className="px-4 py-3">Assignments</th>
                    <th className="px-4 py-3">Offline</th>
                    <th className="px-4 py-3">Queue</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3">Heartbeat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {summary.officers.map((officer) => (
                    <tr key={officer.officerId}>
                      <td className="px-4 py-3">{officer.displayName}</td>
                      <td className="px-4 py-3">{officer.status}</td>
                      <td className="px-4 py-3">{officer.batteryLevel ?? "—"}</td>
                      <td className="px-4 py-3">{officer.gpsStatus ?? "—"}</td>
                      <td className="px-4 py-3">{officer.activeAssignmentCount}</td>
                      <td className="px-4 py-3">{officer.isOffline ? "Yes" : "No"}</td>
                      <td className="px-4 py-3">{officer.offlineQueueDepth ?? 0}</td>
                      <td className="px-4 py-3">{(officer.riskFlags ?? []).join(", ") || "—"}</td>
                      <td className="px-4 py-3">{officer.lastHeartbeatAt ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {(summary.backupRequests?.length ?? 0) > 0 ? (
            <Panel title="Backup requests">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-3">Officer</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {summary.backupRequests?.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3">{row.officerName}</td>
                        <td className="px-4 py-3">{row.requestType}</td>
                        <td className="px-4 py-3">{row.status}</td>
                        <td className="px-4 py-3">{row.priority}</td>
                        <td className="px-4 py-3">{row.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          {(summary.safetyAlerts?.length ?? 0) > 0 ? (
            <Panel title="Officer safety alerts">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-3">Officer</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {summary.safetyAlerts?.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3">{row.officerName}</td>
                        <td className="px-4 py-3">{row.alertType}</td>
                        <td className="px-4 py-3">{row.status}</td>
                        <td className="px-4 py-3">{row.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}
        </>
      ) : canManage ? (
        <Panel title="No monitoring data">
          <p className="text-sm text-muted">No active field operations were returned for your scope.</p>
        </Panel>
      ) : null}
    </AppShell>
  );
}
