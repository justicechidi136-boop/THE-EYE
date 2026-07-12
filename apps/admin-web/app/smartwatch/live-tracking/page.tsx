import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchSosEvents } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function WatchLiveTrackingPage() {
  const sosEvents = await fetchSosEvents();
  const active = sosEvents.filter((event) => event.status === "Active");

  return (
    <AppShell>
      <PageHeader eyebrow="Emergency watch movement" title="Live tracking" action={<StatusBadge tone="danger">{active.length} active</StatusBadge>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Panel title="Live map and movement trail">
          <div className="leaflet-grid relative min-h-[560px] rounded-lg border border-line">
            <div className="absolute left-[52%] top-[40%] h-5 w-5 rounded-full bg-red-600 ring-4 ring-red-600/20" />
            <div className="absolute left-[48%] top-[48%] h-3 w-3 rounded-full bg-red-400" />
            <div className="absolute left-[45%] top-[55%] h-3 w-3 rounded-full bg-red-300" />
            <div className="absolute bottom-3 left-3 rounded-md border border-line bg-surface/95 px-3 py-2 text-xs shadow-soft">
              Location updates every 5 seconds during watch emergency mode.
            </div>
          </div>
        </Panel>
        <Panel title="Current emergency tracks">
          <div className="grid gap-3">
            {sosEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-line bg-surfaceMuted p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{event.deviceId}</p>
                    <p className="text-sm text-muted">{event.incidentId} - {event.sourceMode}</p>
                  </div>
                  <StatusBadge tone={event.status === "Active" ? "danger" : "success"}>{event.status}</StatusBadge>
                </div>
                <p className="mt-2 text-sm">{event.gps.lat}, {event.gps.lng}</p>
                <p className="text-xs text-muted">Speed 18 km/h - last update {event.triggeredAt}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
