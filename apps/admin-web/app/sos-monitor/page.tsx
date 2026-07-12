import { AppShell } from "../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { fetchSosEvents } from "../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function SosMonitorPage() {
  const sosEvents = await fetchSosEvents();
  const active = sosEvents.filter((event) => event.status === "Active");
  const selected = sosEvents[0];

  return (
    <AppShell>
      <PageHeader eyebrow="Smartwatch emergency response" title="Admin SOS monitoring" action={<StatusBadge tone="danger">{active.length} active SOS</StatusBadge>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Panel title="Active SOS map">
          <div className="leaflet-grid relative min-h-[540px] rounded-lg border border-line">
            {sosEvents.map((event, index) => (
              <div key={event.id} className="absolute" style={{ left: `${48 + index * 9}%`, top: `${38 + index * 10}%` }}>
                <span className={`block h-5 w-5 rounded-full ${event.status === "Active" ? "bg-red-600 ring-red-600/20" : "bg-amber-500 ring-amber-500/20"} ring-4`} />
                <div className="mt-2 w-56 rounded-md border border-line bg-surface p-3 text-xs shadow-soft">
                  <p className="font-bold">{event.id} - {event.status}</p>
                  <p className="mt-1 text-muted">{event.incidentId} / {event.sourceMode}</p>
                  <a className="mt-2 block font-semibold text-eye" href={`https://www.google.com/maps/search/?api=1&query=${event.gps.lat},${event.gps.lng}`}>Open location</a>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid gap-5">
          {selected ? (
            <Panel title="Selected SOS">
              <div className="grid gap-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase text-muted">Incident</p>
                    <p className="text-lg font-black">{selected.incidentId}</p>
                  </div>
                  <StatusBadge tone="danger">{selected.priority}</StatusBadge>
                </div>
                <p><span className="font-semibold">User:</span> {selected.user}</p>
                <p><span className="font-semibold">Device:</span> {selected.deviceId}</p>
                <p><span className="font-semibold">Triggered:</span> {selected.triggeredAt}</p>
                <p><span className="font-semibold">Family safety circle:</span> {selected.familyAlerted}</p>
                <p><span className="font-semibold">Response:</span> {selected.response}</p>
                <a className="rounded-md bg-eye px-4 py-3 text-center font-semibold text-white" href={`https://www.google.com/maps/search/?api=1&query=${selected.gps.lat},${selected.gps.lng}`}>Open SOS location</a>
              </div>
            </Panel>
          ) : null}

          <Panel title="SOS queue">
            <div className="grid gap-3">
              {sosEvents.length ? sosEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-line bg-surfaceMuted p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{event.id} / {event.incidentId}</p>
                      <p className="mt-1 text-sm text-muted">{event.user} - {event.deviceId}</p>
                    </div>
                    <StatusBadge tone={event.status === "Active" ? "danger" : "success"}>{event.status}</StatusBadge>
                  </div>
                  <p className="mt-2 text-xs text-muted">{event.gps.lat}, {event.gps.lng} - accuracy {event.gps.accuracy}</p>
                </div>
              )) : <p className="text-sm text-muted">No SOS events in the current admin scope.</p>}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
