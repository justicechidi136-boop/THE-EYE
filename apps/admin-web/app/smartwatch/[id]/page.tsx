import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { smartwatchDevices } from "../../../lib/mock-data";

export default async function WatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const device = smartwatchDevices.find((item) => item.id === id) ?? smartwatchDevices[0];
  return (
    <AppShell>
      <PageHeader eyebrow="Watch Detail" title={device.deviceId} action={<StatusBadge tone={device.status === "Online" ? "success" : "warning"}>{device.status}</StatusBadge>} />
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
          <div className="grid gap-3">
            <button className="rounded-md border border-line px-4 py-3 text-sm font-semibold">Send heartbeat request</button>
            <button className="rounded-md border border-line px-4 py-3 text-sm font-semibold">Schedule firmware update</button>
            <button className="rounded-md border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-700">Remote disable</button>
            <button className="rounded-md border border-red-200 px-4 py-3 text-sm font-semibold text-red-700">Remote wipe</button>
          </div>
        </Panel>
        <Panel title="Latest location">
          <div className="leaflet-grid relative min-h-[340px] rounded-lg border border-line">
            <span className="absolute left-[52%] top-[45%] h-5 w-5 rounded-full bg-red-600 ring-4 ring-red-600/20" />
          </div>
        </Panel>
        <Panel title="Health">
          <div className="grid gap-3 text-sm">
            <p><span className="font-semibold">Battery:</span> {device.battery}%</p>
            <p><span className="font-semibold">Signal:</span> {device.signal}%</p>
            <p><span className="font-semibold">Last seen:</span> {device.lastSeen}</p>
            <p><span className="font-semibold">GPS:</span> {device.lastGps.lat}, {device.lastGps.lng}</p>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
