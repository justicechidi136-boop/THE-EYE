import Link from "next/link";
import { AppShell } from "../../../../components/app-shell";
import { SmartwatchSubnav } from "../../../../components/smartwatch/smartwatch-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../../components/ui";
import { fetchSosEvents } from "../../../../lib/api/data";
import { getAdminSession } from "../../../../lib/session";
import { canManageSmartwatches } from "../../../../lib/smartwatch-permissions";

export const dynamic = "force-dynamic";

export default async function SmartWatchLiveTrackingPage() {
  const session = await getAdminSession();
  const canManage = canManageSmartwatches(session);
  const sosEvents = await fetchSosEvents();
  const active = sosEvents.filter((event) => event.status === "Active");

  return (
    <AppShell>
      <PageHeader eyebrow="Devices" title="Live tracking" action={<StatusBadge tone="danger">{active.length} active</StatusBadge>} />
      <SmartwatchSubnav canManage={canManage} />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Panel title="Active emergency positions">
          <div className="grid min-h-[420px] gap-3">
            {active.length ? active.map((event) => (
              <div key={event.id} className="rounded-lg border border-line bg-surfaceMuted p-4">
                <p className="font-semibold">{event.deviceId}</p>
                <p className="text-sm text-muted">{event.incidentId} · {event.sourceMode}</p>
                <a className="mt-2 inline-block font-semibold text-eye" href={`https://www.google.com/maps/search/?api=1&query=${event.gps.lat},${event.gps.lng}`}>
                  Open live position
                </a>
              </div>
            )) : <p className="text-muted">No active SOS events. GPS trails refresh every 5 seconds during emergencies via `/smartwatch/sos/:id/tracking`.</p>}
          </div>
        </Panel>
        <Panel title="All recent tracks">
          <div className="grid gap-3">
            {sosEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-line bg-surfaceMuted p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/devices/smart-watches/${event.deviceId}`} className="font-semibold text-eye hover:underline">{event.deviceId}</Link>
                    <p className="text-sm text-muted">{event.incidentId} · {event.sourceMode}</p>
                  </div>
                  <StatusBadge tone={event.status === "Active" ? "danger" : "success"}>{event.status}</StatusBadge>
                </div>
                <p className="mt-2 text-sm">{event.gps.lat}, {event.gps.lng}</p>
                <p className="text-xs text-muted">Last update {event.triggeredAt}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
