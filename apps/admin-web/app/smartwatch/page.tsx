import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { fetchSmartwatchDevices } from "../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function SmartwatchDevicesPage() {
  const smartwatchDevices = await fetchSmartwatchDevices();
  const online = smartwatchDevices.filter((device) => device.status === "Online").length;

  return (
    <AppShell>
      <PageHeader eyebrow="Watch Management" title="All watches" action={<StatusBadge tone="success">{online} online</StatusBadge>} />
      <div className="grid gap-5">
        <Panel title="Add watch">
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_180px_180px_160px]">
            <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Device ID" />
            <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Owner user ID or phone" />
            <select className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye">
              <option>Paired phone</option>
              <option>Standalone cellular</option>
            </select>
            <select className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye">
              <option>QR Code</option>
              <option>Bluetooth</option>
              <option>Pairing Code</option>
              <option>NFC future</option>
            </select>
            <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Provider" />
            <button className="rounded-md bg-eye px-4 py-3 text-sm font-semibold text-white">Pair watch</button>
          </div>
        </Panel>

        <Panel title="Pairing and security">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px] text-left text-sm">
              <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                <tr><th className="px-4 py-3">Device</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Pairing</th><th className="px-4 py-3">Battery</th><th className="px-4 py-3">Signal</th><th className="px-4 py-3">Firmware</th><th className="px-4 py-3">Last GPS</th><th className="px-4 py-3">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {smartwatchDevices.map((device) => (
                  <tr key={device.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">
                        <Link href={`/smartwatch/${device.id}`} className="text-eye hover:underline">{device.deviceId}</Link>
                      </p>
                      <p className="text-xs text-muted">{device.provider} - {device.model}</p>
                    </td>
                    <td className="px-4 py-3">{device.owner}</td>
                    <td className="px-4 py-3"><StatusBadge tone="info">{device.mode}</StatusBadge></td>
                    <td className="px-4 py-3"><p>{device.pairingMethod}</p><p className="text-xs text-muted">{device.security}</p></td>
                    <td className="px-4 py-3">
                      <div className="h-2 w-24 rounded-full bg-surfaceMuted"><div className="h-2 rounded-full bg-eye" style={{ width: `${device.battery}%` }} /></div>
                      <p className="mt-1 text-xs text-muted">{device.battery}% - {device.lastSeen}</p>
                    </td>
                    <td className="px-4 py-3">{device.signal}%</td>
                    <td className="px-4 py-3"><p className="font-semibold">{device.firmware}</p><p className="text-xs text-muted">Signed update required</p></td>
                    <td className="px-4 py-3">
                      <a className="font-semibold text-eye" href={`https://www.google.com/maps/search/?api=1&query=${device.lastGps.lat},${device.lastGps.lng}`}>{device.lastGps.lat}, {device.lastGps.lng}</a>
                      <p className="text-xs text-muted">Accuracy {device.lastGps.accuracy}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="rounded-md border border-line px-3 py-2 text-xs font-semibold">Rename</button>
                        <button className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Disable</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
