import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { ActivateStandaloneWorkflow } from "../../../components/smartwatch/activate-standalone-workflow";
import { SmartwatchSubnav } from "../../../components/smartwatch/smartwatch-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchSmartwatchManagementDevices } from "../../../lib/api/data";
import { getAdminSession } from "../../../lib/session";
import { smartwatchDeviceState } from "../../../lib/smartwatch-management";
import { canManageSmartwatches } from "../../../lib/smartwatch-permissions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  cursor?: string;
  search?: string;
  pairingStatus?: string;
  deviceStatus?: string;
}>;

function stateTone(state: string): "danger" | "warning" | "success" | "neutral" {
  if (state === "Locked") return "danger";
  if (state === "Deactivated") return "warning";
  if (state === "Online") return "success";
  return "neutral";
}

export default async function SmartWatchesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getAdminSession();
  const canManage = canManageSmartwatches(session);
  const params = await searchParams;
  const result = canManage
    ? await fetchSmartwatchManagementDevices({
        cursor: params.cursor,
        search: params.search,
        pairingStatus: params.pairingStatus,
        deviceStatus: params.deviceStatus,
      })
    : { kind: "unauthorized" as const, devices: [] as const };
  const devices = result.devices;
  const online = devices.filter((device) => smartwatchDeviceState(device) === "Online").length;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Devices"
        title="Smart watches"
        action={<StatusBadge tone="success">{online} online</StatusBadge>}
      />
      <SmartwatchSubnav canManage={canManage} />
      <div className="grid gap-5">
        {!canManage || result.kind === "unauthorized" ? (
          <Panel title="Smartwatch access">
            <div role="alert" className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
              Your admin account does not have permission to view or manage smartwatch devices.
            </div>
          </Panel>
        ) : null}

        {canManage ? (
          <Panel title="Activate standalone watch">
            <ActivateStandaloneWorkflow canManage />
          </Panel>
        ) : null}

        {result.kind === "error" ? (
          <Panel title="Registered watches">
            <div role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
              <p className="font-semibold">Unable to load smartwatch devices</p>
              <p className="mt-1">{result.message}</p>
              <Link href="/devices/smart-watches" className="mt-3 inline-block font-semibold underline">
                Try again
              </Link>
            </div>
          </Panel>
        ) : null}

        {result.kind === "success" ? (
          <Panel title="Registered watches">
            <form method="get" className="mb-4 grid gap-3 sm:grid-cols-[minmax(220px,1fr)_180px_180px_auto]">
              <label className="grid gap-1 text-xs font-semibold text-muted">
                Search
                <input
                  name="search"
                  defaultValue={params.search}
                  placeholder="Device ID, name or serial"
                  className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-muted">
                Pairing
                <select name="pairingStatus" defaultValue={params.pairingStatus ?? ""} className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink">
                  <option value="">All</option>
                  <option value="paired">Paired</option>
                  <option value="unpaired">Unpaired</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-muted">
                Device status
                <select name="deviceStatus" defaultValue={params.deviceStatus ?? ""} className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink">
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="locked">Locked</option>
                  <option value="deactivated">Deactivated</option>
                </select>
              </label>
              <button type="submit" className="self-end rounded-md bg-eye px-4 py-2 text-sm font-semibold text-white">
                Apply
              </button>
            </form>

            {devices.length === 0 ? (
              <div className="rounded-md border border-dashed border-line p-8 text-center">
                <p className="font-semibold text-ink">No smartwatch devices found</p>
                <p className="mt-1 text-sm text-muted">Registered watches will appear here when they match this admin scope and the selected filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1380px] text-left text-sm">
                  <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-3">Device</th>
                      <th className="px-3 py-3">Owner</th>
                      <th className="px-3 py-3">Pairing</th>
                      <th className="px-3 py-3">Activation</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Battery / signal</th>
                      <th className="px-3 py-3">Firmware</th>
                      <th className="px-3 py-3">Last seen</th>
                      <th className="px-3 py-3">Area</th>
                      <th className="px-3 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {devices.map((device) => {
                      const state = smartwatchDeviceState(device);
                      return (
                        <tr key={device.id}>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-ink">{device.watchName}</p>
                            <p className="font-mono text-xs text-muted">{device.deviceId}</p>
                            <p className="text-xs text-muted">{[device.manufacturer, device.model].filter(Boolean).join(" ") || "Metadata unavailable"}</p>
                          </td>
                          <td className="px-3 py-3">{device.currentAssignee ?? device.currentOwner}</td>
                          <td className="px-3 py-3"><StatusBadge tone="info">{device.pairingStatus}</StatusBadge></td>
                          <td className="px-3 py-3">
                            <StatusBadge tone={device.activationStatus === "LOCKED" ? "danger" : "neutral"}>{device.activationStatus}</StatusBadge>
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge tone={stateTone(state)}>{state}</StatusBadge>
                            {device.deactivationReason ? <p className="mt-1 max-w-[180px] text-xs text-muted">{device.deactivationReason}</p> : null}
                          </td>
                          <td className="px-3 py-3">
                            {device.batteryLevel == null ? "-" : `${device.batteryLevel}%`}
                            <span className="text-muted"> / </span>
                            {device.signalStrength == null ? "-" : `${device.signalStrength}%`}
                          </td>
                          <td className="px-3 py-3">{device.firmwareVersion ?? "-"}</td>
                          <td className="px-3 py-3 text-xs">{device.lastSeen ? new Date(device.lastSeen).toLocaleString() : "Never"}</td>
                          <td className="px-3 py-3">{[device.lastKnownLga, device.lastKnownState].filter(Boolean).join(", ") || "-"}</td>
                          <td className="px-3 py-3">
                            <Link href={`/devices/smart-watches/${encodeURIComponent(device.id)}`} className="font-semibold text-eye hover:underline">
                              Manage
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {result.hasMore && result.nextCursor ? (
              <div className="mt-4 border-t border-line pt-4">
                <Link
                  href={`/devices/smart-watches?${new URLSearchParams({
                    ...(params.search ? { search: params.search } : {}),
                    ...(params.pairingStatus ? { pairingStatus: params.pairingStatus } : {}),
                    ...(params.deviceStatus ? { deviceStatus: params.deviceStatus } : {}),
                    cursor: result.nextCursor,
                  }).toString()}`}
                  className="text-sm font-semibold text-eye hover:underline"
                >
                  Next page
                </Link>
              </div>
            ) : null}
          </Panel>
        ) : null}
      </div>
    </AppShell>
  );
}
