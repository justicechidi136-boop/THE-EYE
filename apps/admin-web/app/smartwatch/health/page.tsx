import { AppShell } from "../../../components/app-shell";
import { MetricCard, PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { smartwatchDevices } from "../../../lib/mock-data";

export default function WatchHealthPage() {
  const lowBattery = smartwatchDevices.filter((device) => device.battery < 20).length;
  const weakSignal = smartwatchDevices.filter((device) => device.signal < 30).length;
  return (
    <AppShell>
      <PageHeader eyebrow="Device health" title="Battery, signal, and last seen" action={<StatusBadge tone={lowBattery ? "warning" : "success"}>{lowBattery} low battery</StatusBadge>} />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard label="Online watches" value={`${smartwatchDevices.filter((device) => device.status === "Online").length}`} detail="Live heartbeat received" />
        <MetricCard label="Weak signal" value={`${weakSignal}`} detail="Below 30 percent" />
        <MetricCard label="Firmware attention" value={`${smartwatchDevices.filter((device) => device.security !== "Certificate valid").length}`} detail="Signature or version warning" />
      </div>
      <Panel title="Health queue">
        <div className="grid gap-3">
          {smartwatchDevices.map((device) => (
            <div key={device.id} className="grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-[1fr_140px_140px_180px]">
              <div>
                <p className="font-semibold">{device.deviceId}</p>
                <p className="text-sm text-muted">{device.owner} - {device.mode} - last seen {device.lastSeen}</p>
              </div>
              <StatusBadge tone={device.battery < 20 ? "warning" : "success"}>{device.battery}% battery</StatusBadge>
              <StatusBadge tone={device.signal < 30 ? "warning" : "success"}>{device.signal}% signal</StatusBadge>
              <StatusBadge tone={device.security === "Certificate valid" ? "success" : "warning"}>{device.security}</StatusBadge>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
