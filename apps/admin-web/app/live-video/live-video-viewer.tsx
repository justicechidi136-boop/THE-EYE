"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShellFrame } from "../../components/app-shell-frame";
import { LivekitAdminPlayer, type LivekitPlayerState } from "../../components/livekit-admin-player";
import { LocationTrailMap } from "../../components/location-trail-map";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import type { LiveVideoSessionView } from "../../lib/types/admin-views";

type Props = {
  sessions: LiveVideoSessionView[];
};

type LiveOverlay = {
  incidentId: string;
  date: string;
  time: string;
  gps: string;
  accuracy: string;
  reporter: string;
  connectionStatus: string;
  signedLocationPath: string;
};

export function LiveVideoViewer({ sessions }: Props) {
  const [selectedId, setSelectedId] = useState(sessions[0]?.id ?? "");
  const [playerState, setPlayerState] = useState<LivekitPlayerState>("idle");
  const [overlay, setOverlay] = useState<LiveOverlay | null>(null);
  const active = sessions.filter((session) => session.status === "Active");
  const selected = sessions.find((session) => session.id === selectedId) ?? sessions[0] ?? {
    id: "-",
    incidentId: "-",
    roomName: "-",
    status: "Inactive",
    startedAt: "",
    date: "-",
    time: "-",
    latitude: 0,
    longitude: 0,
    accuracy: "-",
    reporter: "-",
    viewerScope: "-",
    signedLocationPath: "#",
    locationHistory: [],
    recordingConfigured: false,
    connectionStatus: "Inactive",
  };

  const fallbackOverlay = useMemo<LiveOverlay>(() => ({
    incidentId: selected.incidentId,
    date: selected.date,
    time: selected.time,
    gps: `${selected.latitude}, ${selected.longitude}`,
    accuracy: selected.accuracy,
    reporter: selected.reporter,
    connectionStatus: playerState === "connected" ? "Connected" : selected.connectionStatus,
    signedLocationPath: selected.signedLocationPath,
  }), [playerState, selected]);

  const displayOverlay = overlay ?? fallbackOverlay;
  const gps = displayOverlay.gps;

  useEffect(() => {
    if (selected.status !== "Active" || selected.id === "-") {
      setOverlay(null);
      return;
    }

    let cancelled = false;
    async function pollLatestLocation() {
      try {
        const response = await fetch(`/api/live-video/sessions/${selected.id}/location/latest`);
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as {
          evidenceOverlay?: Record<string, string>;
          signedOpenLocationUrl?: string | null;
        };
        const evidence = payload.evidenceOverlay;
        if (!evidence || cancelled) return;
        setOverlay({
          incidentId: evidence.incidentId ?? selected.incidentId,
          date: evidence.date ?? selected.date,
          time: evidence.time ?? selected.time,
          gps: evidence.gps ?? gps,
          accuracy: evidence.accuracy ?? selected.accuracy,
          reporter: evidence.reporter ?? selected.reporter,
          connectionStatus: playerState === "connected" ? "Connected" : playerState === "reconnecting" ? "Reconnecting" : selected.connectionStatus,
          signedLocationPath: payload.signedOpenLocationUrl ?? selected.signedLocationPath,
        });
      } catch {
        // Keep the last known overlay during temporary network failure.
      }
    }

    void pollLatestLocation();
    const timer = window.setInterval(pollLatestLocation, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [gps, playerState, selected.accuracy, selected.connectionStatus, selected.date, selected.id, selected.incidentId, selected.reporter, selected.signedLocationPath, selected.status, selected.time]);

  return (
    <AppShellFrame>
      <PageHeader eyebrow="LiveKit incident streams" title="Live video viewer" action={<StatusBadge tone={active.length ? "success" : "neutral"}>{active.length} active</StatusBadge>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Panel title="Authorized stream viewer">
          <div className="relative min-h-[520px] overflow-hidden rounded-lg border border-line bg-command text-white">
            <LivekitAdminPlayer sessionId={selected.id} sessionStatus={selected.status} onStateChange={setPlayerState} />

            <div className="absolute left-4 top-4 w-[330px] rounded-lg border border-white/15 bg-black/80 p-4 shadow-soft">
              <p className="text-sm font-black tracking-normal text-white">THE EYE LIVE EVIDENCE</p>
              <div className="mt-3 grid gap-1 text-sm text-white/85">
                <p>Incident: {displayOverlay.incidentId}</p>
                <p>Date: {displayOverlay.date}</p>
                <p>Time: {displayOverlay.time}</p>
                <a className="font-semibold text-white underline" href={displayOverlay.signedLocationPath}>GPS: {gps}</a>
                <p>Accuracy: {displayOverlay.accuracy}</p>
                <p>Reporter: {displayOverlay.reporter}</p>
                <p>Status: {displayOverlay.connectionStatus}</p>
              </div>
              {selected.recordingConfigured ? (
                <p className="mt-3 text-xs text-emerald-200">Server-side recording is configured for this session.</p>
              ) : null}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <a className="rounded-md bg-surface px-3 py-2 text-center text-xs font-bold text-command" href={displayOverlay.signedLocationPath}>Open Location</a>
                <button className="rounded-md border border-white/30 px-3 py-2 text-xs font-bold text-white" onClick={() => navigator.clipboard.writeText(gps)}>Copy Coordinates</button>
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid gap-5">
          <Panel title="Latest live GPS">
            <div className="grid gap-3">
              <a className="rounded-lg border border-line bg-surfaceMuted p-3 font-semibold text-eye" href={displayOverlay.signedLocationPath}>{gps}</a>
              <p className="text-sm text-muted">Accuracy {displayOverlay.accuracy}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <a className="rounded-md bg-eye px-4 py-3 text-center text-sm font-semibold text-white" href={displayOverlay.signedLocationPath}>Open Live Location</a>
                <button className="rounded-md border border-line px-4 py-3 text-center text-sm font-semibold" onClick={() => navigator.clipboard.writeText(gps)}>Copy Coordinates</button>
              </div>
            </div>
          </Panel>

          <Panel title="Incident streams">
            <div className="grid gap-3">
              {sessions.length ? sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedId(session.id)}
                  className={`rounded-lg border p-3 text-left ${selectedId === session.id ? "border-eye bg-emerald-50" : "border-line bg-surfaceMuted"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{session.incidentId}</p>
                      <p className="mt-1 text-sm text-muted">{session.roomName}</p>
                    </div>
                    <StatusBadge tone={session.status === "Active" ? "success" : "neutral"}>{session.status}</StatusBadge>
                  </div>
                  <p className="mt-2 text-xs text-muted">Started {session.startedAt} - {session.viewerScope}</p>
                </button>
              )) : <p className="text-sm text-muted">No live video sessions returned from `/live-video/sessions/active`.</p>}
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-5 grid gap-5">
        <LocationTrailMap title="Live map marker and movement trail" history={selected.locationHistory} openLocationHref={displayOverlay.signedLocationPath} />
      </div>
    </AppShellFrame>
  );
}
