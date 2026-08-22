import Link from "next/link";
import { AppShell } from "../../../../components/app-shell";
import { SmartwatchSubnav } from "../../../../components/smartwatch/smartwatch-subnav";
import { MetricCard, PageHeader, Panel, StatusBadge } from "../../../../components/ui";
import { fetchSmartwatchManagementDevices } from "../../../../lib/api/data";
import { getAdminSession } from "../../../../lib/session";
import { smartwatchDeviceState } from "../../../../lib/smartwatch-management";
import { canManageSmartwatches } from "../../../../lib/smartwatch-permissions";

export const dynamic = "force-dynamic";

export default async function SmartWatchHealthPage() {
  const session = await getAdminSession();
  const canManage = canManageSmartwatches(session);
  const result = canManage
    ? await fetchSmartwatchManagementDevices({ limit: "100" })
    : { kind: "unauthorized" as const, devices: [] as const };
  const smartwatchDevices = result.devices;
  const lowBattery = smartwatchDevices.filter((device) => device.batteryLevel != null && device.batteryLevel < 20).length;
  const weakSignal = smartwatchDevices.filter((device) => device.signalStrength != null && device.signalStrength < 30).length;

  return (
    <AppShell>
      <PageHeader eyebrow="Devices" title="Device health" action={<StatusBadge tone={lowBattery ? "warning" : "success"}>{lowBattery} low battery</StatusBadge>} />
      <SmartwatchSubnav canManage={canManage} />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard label="Online watches" value={`${smartwatchDevices.filter((device) => smartwatchDeviceState(device) === "Online").length}`} detail="Heartbeat received in the last 10 minutes" />
        <MetricCard label="Weak signal" value={`${weakSignal}`} detail="Below 30 percent" />
        <MetricCard label="Unknown telemetry" value={`${smartwatchDevices.filter((device) => !device.lastSeen).length}`} detail="No heartbeat recorded" />
      </div>
      <Panel title="Health queue">
        {result.kind === "unauthorized" ? (
          <div role="alert" className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            Your admin account does not have permission to view smartwatch health.
          </div>
        ) : result.kind === "error" ? (
          <div role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            <p className="font-semibold">Unable to load device health</p>
            <p className="mt-1">{result.message}</p>
            <Link href="/devices/smart-watches/health" className="mt-3 inline-block font-semibold underline">Try again</Link>
          </div>
        ) : smartwatchDevices.length === 0 ? (
          <div className="rounded-md border border-dashed border-line p-8 text-center">
            <p className="font-semibold text-ink">No device health data</p>
            <p className="mt-1 text-sm text-muted">Health appears after a registered watch sends its first heartbeat.</p>
          </div>
        ) : <div className="grid gap-3">
          {smartwatchDevices.map((device) => (
            <div key={device.id} className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-[1fr_140px_140px_180px]">
              <div>
                <Link href={`/devices/smart-watches/${device.id}`} className="font-semibold text-eye hover:underline">{device.deviceId}</Link>
                <p className="text-sm text-muted">{device.currentAssignee ?? device.currentOwner} · {device.connectivityType} · {device.lastSeen ? `last seen ${new Date(device.lastSeen).toLocaleString()}` : "no heartbeat yet"}</p>
              </div>
              <StatusBadge tone={device.batteryLevel == null || device.batteryLevel < 20 ? "warning" : "success"}>{device.batteryLevel == null ? "Battery unknown" : `${device.batteryLevel}% battery`}</StatusBadge>
              <StatusBadge tone={device.signalStrength == null || device.signalStrength < 30 ? "warning" : "success"}>{device.signalStrength == null ? "Signal unknown" : `${device.signalStrength}% signal`}</StatusBadge>
              <StatusBadge tone={smartwatchDeviceState(device) === "Online" ? "success" : smartwatchDeviceState(device) === "Locked" ? "danger" : "warning"}>{smartwatchDeviceState(device)} · {device.firmwareVersion ?? "version unknown"}</StatusBadge>
            </div>
          ))}
        </div>}
      </Panel>
    </AppShell>
  );
}
