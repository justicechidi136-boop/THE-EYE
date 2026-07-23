import { AppShell } from "../../../components/app-shell";
import { SmartwatchDeviceActions } from "../../../components/smartwatch-device-actions";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import {
  fetchSmartwatchDeviceDetail,
  fetchSmartwatchDeviceAudit,
  fetchSmartwatchDeviceTelemetry,
  fetchSmartwatchDeviceActiveIncident,
  fetchSmartwatchDeviceEmergencyHistory,
} from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function WatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [device, telemetry, activeIncident, history, audit] = await Promise.all([
    fetchSmartwatchDeviceDetail(id),
    fetchSmartwatchDeviceTelemetry(id),
    fetchSmartwatchDeviceActiveIncident(id),
    fetchSmartwatchDeviceEmergencyHistory(id),
    fetchSmartwatchDeviceAudit(id),
  ]);

  if (!device) {
    return (
      <AppShell>
        <PageHeader eyebrow="Watch Detail" title="Device not found" action={<StatusBadge tone="warning">Missing</StatusBadge>} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Watch Detail"
        title={device.deviceId}
        action={<StatusBadge tone={device.status === "Online" ? "success" : "warning"}>{device.status}</StatusBadge>}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Panel title="Identity and pairing">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <p><span className="font-semibold">Owner:</span> {device.owner}</p>
            <p><span className="font-semibold">Model:</span> {device.model}</p>
            <p><span className="font-semibold">Current mode:</span> {device.mode}</p>
            <p><span className="font-semibold">Preferred mode:</span> {device.preferredMode}</p>
            <p><span className="font-semibold">Pairing:</span> {device.pairingMethod}</p>
            <p><span className="font-semibold">Security:</span> {device.security}</p>
            <p><span className="font-semibold">Firmware:</span> {device.firmware}</p>
            <p><span className="font-semibold">Critical alerts:</span> {device.alerts}</p>
          </div>
        </Panel>
        <Panel title="Remote commands">
          <SmartwatchDeviceActions deviceId={device.id} deviceLabel={device.deviceId} />
        </Panel>
        <Panel title="Latest location">
          <div className="grid gap-2 text-sm">
            <p>
              <span className="font-semibold">GPS:</span>{" "}
              {telemetry?.lastGps.lat ?? device.lastGps.lat},{" "}
              {telemetry?.lastGps.lng ?? device.lastGps.lng}
            </p>
            <p>
              <span className="font-semibold">Accuracy:</span>{" "}
              {telemetry?.lastGps.accuracy ?? device.lastGps.accuracy}
              {telemetry?.stale ? " (stale telemetry)" : ""}
            </p>
          </div>
        </Panel>
        <Panel title="Health">
          <div className="grid gap-3 text-sm">
            <p><span className="font-semibold">Battery:</span> {telemetry?.batteryLevel ?? device.battery}%</p>
            <p><span className="font-semibold">Signal:</span> {telemetry?.signalStrength ?? device.signal}%</p>
            <p><span className="font-semibold">Last seen:</span> {device.lastSeen}</p>
            <p>
              <span className="font-semibold">Active incident:</span>{" "}
              {activeIncident?.incidentId ?? "None"}
            </p>
          </div>
        </Panel>
        <Panel title="Emergency history">
          <ul className="grid gap-2 text-sm">
            {(history ?? []).slice(0, 5).map((event) => (
              <li key={event.id}>
                {event.triggeredAt} — {event.status} {event.incidentId ? `(incident ${event.incidentId})` : ""}
              </li>
            ))}
            {(history ?? []).length === 0 ? <li>No SOS events recorded.</li> : null}
          </ul>
        </Panel>
        <Panel title="Audit history">
          <ul className="grid gap-2 text-sm">
            {(audit ?? []).slice(0, 8).map((entry) => (
              <li key={entry.id}>
                {entry.createdAt} — {entry.action}
              </li>
            ))}
            {(audit ?? []).length === 0 ? <li>No audit entries.</li> : null}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
