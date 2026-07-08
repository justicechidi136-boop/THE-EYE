"use client";

import { AppShell } from "../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { incidents, liveVideoSessions } from "../../lib/mock-data";

export default function LiveVideoPage() {
  const active = liveVideoSessions.filter((session) => session.status === "Active");
  const selected = liveVideoSessions[0];
  const incident = incidents.find((item) => item.id === selected.incidentId);
  const gps = `${selected.latitude}, ${selected.longitude}`;
  const signedLocationPath = selected.signedLocationPath;

  return (
    <AppShell>
      <PageHeader eyebrow="LiveKit incident streams" title="Live video viewer" action={<StatusBadge tone="success">{active.length} active</StatusBadge>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Panel title="Authorized stream viewer">
          <div className="relative min-h-[520px] overflow-hidden rounded-lg border border-line bg-command text-white">
            {/* TODO: Replace placeholder with LiveKit room participant video once production LiveKit credentials are configured. */}
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-red-600">
                  <span className="text-3xl font-black">LIVE</span>
                </div>
                <p className="text-xl font-semibold">{selected.incidentId} citizen livestream</p>
                <p className="mt-2 text-sm text-white/65">Room: {selected.roomName}</p>
              </div>
            </div>

            <div className="absolute left-4 top-4 w-[330px] rounded-lg border border-white/15 bg-black/80 p-4 shadow-soft">
              <p className="text-sm font-black tracking-normal text-white">THE EYE LIVE EVIDENCE</p>
              <div className="mt-3 grid gap-1 text-sm text-white/85">
                <p>Incident: {selected.incidentId}</p>
                <p>Date: {selected.date}</p>
                <p>Time: {selected.time}</p>
                <a className="font-semibold text-white underline" href={signedLocationPath}>GPS: {gps}</a>
                <p>Accuracy: {selected.accuracy}</p>
                <p>Reporter: {selected.reporter}</p>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <a className="rounded-md bg-white px-3 py-2 text-center text-xs font-bold text-command" href={signedLocationPath}>Open Location</a>
                <button className="rounded-md border border-white/30 px-3 py-2 text-xs font-bold text-white" onClick={() => navigator.clipboard.writeText(gps)}>Copy Coordinates</button>
              </div>
              <a className="mt-2 block w-full rounded-md border border-white/30 px-3 py-2 text-center text-xs font-bold text-white" href={`/live-video/sessions/${selected.id}/location/history`}>View Movement Trail</a>
            </div>
          </div>
        </Panel>

        <div className="grid gap-5">
          <Panel title="Latest live GPS">
            <div className="grid gap-3">
              <a className="rounded-lg border border-line bg-slate-50 p-3 font-semibold text-eye" href={signedLocationPath}>{gps}</a>
              <p className="text-sm text-muted">Accuracy {selected.accuracy} - signed route {selected.signedLocationPath}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <a className="rounded-md bg-eye px-4 py-3 text-center text-sm font-semibold text-white" href={signedLocationPath}>Open Live Location</a>
                <button className="rounded-md border border-line px-4 py-3 text-center text-sm font-semibold" onClick={() => navigator.clipboard.writeText(gps)}>Copy Coordinates</button>
              </div>
            </div>
          </Panel>

          <Panel title="Live map marker">
            <div className="leaflet-grid relative min-h-[260px] rounded-lg border border-line">
              {/* TODO: Replace placeholder marker with Google Maps/Mapbox realtime marker fed by live video GPS websocket events. */}
              <span className="absolute left-[54%] top-[42%] h-5 w-5 rounded-full bg-red-600 ring-4 ring-red-600/20" />
              <div className="absolute bottom-3 left-3 rounded-md border border-line bg-white/95 px-3 py-2 text-xs shadow-soft">
                Marker updates from latest GPS every 5 seconds.
              </div>
            </div>
          </Panel>

          <Panel title="Location history timeline">
            <ol className="grid gap-3">
              {selected.locationHistory.map((item) => (
                <li key={`${item.time}-${item.gps}`} className="grid grid-cols-[92px_1fr] gap-3 text-sm">
                  <span className="font-semibold text-eye">{item.time}</span>
                  <span className="text-muted">{item.gps} - {item.accuracy}</span>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Incident streams">
            <div className="grid gap-3">
              {liveVideoSessions.map((session) => {
                const streamIncident = incidents.find((item) => item.id === session.incidentId);
                return (
                  <div key={session.id} className="rounded-lg border border-line bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{session.incidentId}</p>
                        <p className="mt-1 text-sm text-muted">{streamIncident?.title ?? incident?.title ?? "Incident stream"}</p>
                      </div>
                      <StatusBadge tone={session.status === "Active" ? "success" : "neutral"}>{session.status}</StatusBadge>
                    </div>
                    <p className="mt-2 text-xs text-muted">{session.roomName}</p>
                    <p className="mt-1 text-xs text-muted">Started {session.startedAt} - {session.viewerScope}</p>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
