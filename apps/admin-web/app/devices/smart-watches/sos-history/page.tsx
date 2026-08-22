import Link from "next/link";
import { AppShell } from "../../../../components/app-shell";
import { SmartwatchSubnav } from "../../../../components/smartwatch/smartwatch-subnav";
import { PageHeader, Panel, StatusBadge } from "../../../../components/ui";
import { fetchSosEvents } from "../../../../lib/api/data";
import { getAdminSession } from "../../../../lib/session";
import { canManageSmartwatches, canViewSmartwatchSos } from "../../../../lib/smartwatch-permissions";
import type { SosEventView } from "../../../../lib/types/admin-views";

export const dynamic = "force-dynamic";

export default async function SmartWatchSosHistoryPage() {
  const session = await getAdminSession();
  const canManage = canManageSmartwatches(session);
  const canViewSos = canViewSmartwatchSos(session);
  const events = canViewSos ? await fetchSosEvents() : [];

  return (
    <AppShell>
      <PageHeader eyebrow="Devices" title="SOS history" action={<StatusBadge tone="info">{events.length} events</StatusBadge>} />
      <SmartwatchSubnav canManage={canManage} />
      <Panel title="Recent SOS events">
        {!canViewSos ? (
          <div role="alert" className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            Your admin account does not have permission to view smartwatch SOS events.
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-surfaceMuted text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Triggered</th>
                <th className="px-4 py-3">GPS</th>
                <th className="px-4 py-3">Response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {events.length ? events.map((event: SosEventView) => (
                <tr key={event.id} id={event.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{event.id}</p>
                    {event.incidentId !== "-" ? (
                      <Link href={`/incidents/${encodeURIComponent(event.incidentId)}`} className="text-xs font-semibold text-eye hover:underline">
                        Open incident {event.incidentId.slice(0, 8)}
                      </Link>
                    ) : <p className="text-xs text-muted">No linked incident</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/devices/smart-watches/${event.deviceId}`} className="font-semibold text-eye hover:underline">{event.deviceId}</Link>
                    <p className="text-xs text-muted">{event.user}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge tone="info">{event.sourceMode}</StatusBadge></td>
                  <td className="px-4 py-3"><StatusBadge tone={event.priority === "P1" ? "danger" : "warning"}>{event.priority}</StatusBadge></td>
                  <td className="px-4 py-3">{event.triggeredAt}</td>
                  <td className="px-4 py-3">
                    <a className="font-semibold text-eye" href={`https://www.google.com/maps/search/?api=1&query=${event.gps.lat},${event.gps.lng}`}>
                      {event.gps.lat}, {event.gps.lng}
                    </a>
                  </td>
                  <td className="px-4 py-3">{event.response}</td>
                </tr>
              )) : (
                <tr><td className="px-4 py-6 text-muted" colSpan={7}>No SOS events returned from the API yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </Panel>
    </AppShell>
  );
}
