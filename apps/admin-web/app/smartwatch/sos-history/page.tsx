import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchSosEvents } from "../../../lib/api/data";
import type { SosEventView } from "../../../lib/types/admin-views";

export const dynamic = "force-dynamic";

export default async function SmartwatchSosHistoryPage() {
  const events = await fetchSosEvents();

  return (
    <AppShell>
      <PageHeader eyebrow="SOS device history" title="SOS event history" action={<StatusBadge tone="info">{events.length} events</StatusBadge>} />
      <Panel title="Recent SOS events">
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
                <tr key={event.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{event.id}</p>
                    <p className="text-xs text-muted">{event.incidentId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/smartwatch/${event.deviceId}`} className="font-semibold text-eye hover:underline">{event.deviceId}</Link>
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
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={7}>No SOS events returned from the API yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
