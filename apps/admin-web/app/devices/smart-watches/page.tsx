import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { ActivateStandaloneWorkflow } from "../../../components/smartwatch/activate-standalone-workflow";
import { SmartwatchSubnav } from "../../../components/smartwatch/smartwatch-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchSmartwatchDevices } from "../../../lib/api/data";
import { getAdminSession } from "../../../lib/session";
import { canManageSmartwatches } from "../../../lib/smartwatch-permissions";

export const dynamic = "force-dynamic";

export default async function SmartWatchesPage() {
  const session = await getAdminSession();
  const canManage = canManageSmartwatches(session);
  const smartwatchDevices = await fetchSmartwatchDevices();
  const online = smartwatchDevices.filter((device) => device.status === "Online").length;

  return (
    <AppShell>
      <PageHeader eyebrow="Devices" title="Smart watches" action={<StatusBadge tone="success">{online} online</StatusBadge>} />
      <SmartwatchSubnav canManage={canManage} />
      <div className="grid gap-5">
        <Panel title="Activate standalone watch">
          <ActivateStandaloneWorkflow canManage={canManage} />
        </Panel>
        <Panel title="Registered watches">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px] text-left text-sm">
              <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                <tr><th className="px-4 py-3">Device</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Battery</th><th className="px-4 py-3">Signal</th><th className="px-4 py-3">Firmware</th><th className="px-4 py-3">Last GPS</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {smartwatchDevices.map((device) => (
                  <tr key={device.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">
                        <Link href={`/devices/smart-watches/${device.id}`} className="text-eye hover:underline">{device.deviceId}</Link>
                      </p>
                      <p className="text-xs text-muted">{device.provider} - {device.model}</p>
                    </td>
                    <td className="px-4 py-3">{device.owner}</td>
                    <td className="px-4 py-3"><StatusBadge tone="info">{device.mode}</StatusBadge></td>
                    <td className="px-4 py-3"><StatusBadge tone={device.isActive ? "success" : "warning"}>{device.isActive ? device.status : "Inactive"}</StatusBadge></td>
                    <td className="px-4 py-3">{device.battery}%</td>
                    <td className="px-4 py-3">{device.signal}%</td>
                    <td className="px-4 py-3">{device.firmware}</td>
                    <td className="px-4 py-3">
                      <a className="font-semibold text-eye" href={`https://www.google.com/maps/search/?api=1&query=${device.lastGps.lat},${device.lastGps.lng}`}>
                        {device.lastGps.lat}, {device.lastGps.lng}
                      </a>
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
