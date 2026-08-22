import Link from "next/link";
import { AppShell } from "../../../../components/app-shell";
import { SmartwatchDeviceActions } from "../../../../components/smartwatch/smartwatch-device-actions";
import { SmartwatchSubnav } from "../../../../components/smartwatch/smartwatch-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../../components/ui";
import { fetchSmartwatchDeviceDetail } from "../../../../lib/api/data";
import { getAdminSession } from "../../../../lib/session";
import { canManageSmartwatches } from "../../../../lib/smartwatch-permissions";

export const dynamic = "force-dynamic";

export default async function SmartWatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAdminSession();
  const canManage = canManageSmartwatches(session);
  const device = canManage ? await fetchSmartwatchDeviceDetail(id) : null;

  if (!canManage) {
    return (
      <AppShell>
        <PageHeader eyebrow="Devices" title="Smartwatch access" action={<StatusBadge tone="warning">Restricted</StatusBadge>} />
        <SmartwatchSubnav canManage={false} />
        <Panel title="Device detail">
          <div role="alert" className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            Your admin account does not have permission to view or manage smartwatch devices.
          </div>
        </Panel>
      </AppShell>
    );
  }

  if (!device) {
    return (
      <AppShell>
        <PageHeader eyebrow="Devices" title="Smart watch not found" action={<StatusBadge tone="warning">Missing</StatusBadge>} />
        <SmartwatchSubnav canManage={canManage} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader eyebrow="Devices" title={device.deviceId} action={<StatusBadge tone={device.status === "Online" ? "success" : "warning"}>{device.status}</StatusBadge>} />
      <SmartwatchSubnav canManage={canManage} />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Panel title="Identity and telemetry">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <p><span className="font-semibold">Owner:</span> {device.owner}</p>
            <p><span className="font-semibold">Model:</span> {device.model}</p>
            <p><span className="font-semibold">Mode:</span> {device.mode}</p>
            <p><span className="font-semibold">Preferred mode:</span> {device.preferredMode}</p>
            <p><span className="font-semibold">Pairing:</span> {device.pairingMethod}</p>
            <p><span className="font-semibold">Firmware:</span> {device.firmware} ({device.firmwareSignatureStatus})</p>
            <p><span className="font-semibold">Battery:</span> {device.battery}%</p>
            <p><span className="font-semibold">Signal:</span> {device.signal}%</p>
            <p><span className="font-semibold">Last seen:</span> {device.lastSeen}</p>
            <p><span className="font-semibold">Active:</span> {device.isActive ? "Yes" : "No"}</p>
            <p><span className="font-semibold">Activation:</span> {device.activationStatus}</p>
            <p><span className="font-semibold">Security state:</span> {device.deactivationReason ?? device.activationLockReason ?? "No active restriction"}</p>
          </div>
        </Panel>
        <Panel title="Administration">
          <SmartwatchDeviceActions
            deviceId={device.id}
            isActive={device.isActive}
            activationStatus={device.activationStatus}
            restrictionReason={device.activationLockReason ?? device.deactivationReason}
            canManage={canManage}
          />
        </Panel>
        <Panel title="Latest GPS">
          <div className="grid gap-3 text-sm">
            {device.lastGps.lat != null && device.lastGps.lng != null ? (
              <>
                <a className="font-semibold text-eye" href={`https://www.google.com/maps/search/?api=1&query=${device.lastGps.lat},${device.lastGps.lng}`}>
                  {device.lastGps.lat}, {device.lastGps.lng}
                </a>
                <p className="text-muted">Accuracy {device.lastGps.accuracy}{device.lastGpsAt ? ` · ${new Date(device.lastGpsAt).toLocaleString()}` : ""}</p>
              </>
            ) : <p className="text-muted">No authorized GPS fix has been reported by this watch.</p>}
          </div>
        </Panel>
        <Panel title="Recent GPS updates">
          <div className="grid max-h-[320px] gap-2 overflow-y-auto text-sm">
            {device.gpsTracks.length ? device.gpsTracks.map((track, index) => (
              <div key={`${track.capturedAt}-${index}`} className="rounded-md border border-line px-3 py-2">
                {track.lat}, {track.lng} · {track.accuracy} · {track.capturedAt}
              </div>
            )) : <p className="text-muted">No GPS trail recorded yet.</p>}
          </div>
        </Panel>
        <Panel title="Linked SOS events">
          <div className="grid gap-2 text-sm">
            {device.sosEvents.length ? device.sosEvents.map((event) => (
              <Link key={event.id} href={`/devices/smart-watches/sos-history#${event.id}`} className="rounded-md border border-line px-3 py-2 hover:border-eye">
                {event.id} · {event.status} · {event.triggeredAt}
              </Link>
            )) : <p className="text-muted">No SOS events linked to this watch.</p>}
          </div>
        </Panel>
        <Panel title="Firmware updates">
          <div className="grid gap-2 text-sm">
            {device.firmwareUpdates.length ? device.firmwareUpdates.map((update, index) => (
              <div key={`${update.version}-${index}`} className="rounded-md border border-line px-3 py-2">
                v{update.version} · {update.status} · {update.startedAt}
              </div>
            )) : <p className="text-muted">No firmware updates recorded.</p>}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
