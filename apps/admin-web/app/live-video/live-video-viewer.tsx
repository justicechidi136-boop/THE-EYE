"use client";

import { useEffect, useMemo, useState } from "react";
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
  location: string;
  accuracy: string;
  reporter: string;
  connectionStatus: string;
  signedLocationPath: string;
};

function mapHref(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
    : "#";
}

function safeLocationHref(candidate: string | null | undefined, latitude: number, longitude: number) {
  if (candidate && candidate !== "#" && !candidate.startsWith("/live-video/sessions/")) return candidate;
  return mapHref(latitude, longitude);
}

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
    location: "Location unavailable",
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
    location: selected.location,
    accuracy: selected.accuracy,
    reporter: selected.reporter,
    connectionStatus: playerState === "connected"
      ? "Live video connected"
      : playerState === "waiting"
        ? "Connected, waiting for video"
        : playerState === "reconnecting"
          ? "Reconnecting"
          : selected.connectionStatus,
    signedLocationPath: safeLocationHref(selected.signedLocationPath, selected.latitude, selected.longitude),
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
          location: evidence.locationLabel ?? selected.location,
          accuracy: evidence.accuracy ?? selected.accuracy,
          reporter: evidence.reporter ?? selected.reporter,
          connectionStatus: playerState === "connected" ? "Live video connected" : playerState === "waiting" ? "Connected, waiting for video" : playerState === "reconnecting" ? "Reconnecting" : selected.connectionStatus,
          signedLocationPath: safeLocationHref(payload.signedOpenLocationUrl ?? selected.signedLocationPath, selected.latitude, selected.longitude),
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
  }, [gps, playerState, selected.accuracy, selected.connectionStatus, selected.date, selected.id, selected.incidentId, selected.location, selected.reporter, selected.signedLocationPath, selected.status, selected.time]);

  return (
    <>
      <PageHeader eyebrow="LiveKit incident streams" title="Live video viewer" action={<StatusBadge tone={active.length ? "success" : "neutral"}>{active.length} active</StatusBadge>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Panel title="Authorized stream viewer">
          <div className="grid gap-4">
            <div data-testid="live-video-player" className="relative min-h-[520px] overflow-hidden rounded-lg border border-line bg-command text-white">
              <LivekitAdminPlayer sessionId={selected.id} sessionStatus={selected.status} onStateChange={setPlayerState} />
            </div>

            <section data-testid="live-evidence-panel" className="rounded-lg border border-line bg-surfaceMuted p-4 shadow-soft" aria-labelledby="live-evidence-title">
              <p id="live-evidence-title" className="text-sm font-black tracking-normal text-ink">THE EYE LIVE EVIDENCE</p>
              <div className="mt-3 grid gap-1 text-sm text-muted sm:grid-cols-2">
                <p>Incident: {displayOverlay.incidentId}</p>
                <p>Date: {displayOverlay.date}</p>
                <p>Time: {displayOverlay.time}</p>
                <a className="break-words font-semibold text-ink underline decoration-eye decoration-2 underline-offset-4 sm:col-span-2" href={displayOverlay.signedLocationPath}>Location: {displayOverlay.location}</a>
                <p>Accuracy: {displayOverlay.accuracy}</p>
                <p>Reporter: {displayOverlay.reporter}</p>
                <p>Status: {displayOverlay.connectionStatus}</p>
                <p className="break-all text-xs sm:col-span-2">Coordinates: {gps}</p>
              </div>
              {selected.recordingConfigured ? (
                <p className="mt-3 text-xs font-semibold text-success">Server-side recording is configured for this session.</p>
              ) : null}
              <div className="mt-4 grid gap-2 sm:max-w-md sm:grid-cols-2">
                <a className="rounded-md bg-eye px-3 py-2 text-center text-xs font-bold text-white hover:bg-eyeDeep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eye" href={displayOverlay.signedLocationPath}>Open Location</a>
                <button className="rounded-md border border-line bg-surface px-3 py-2 text-xs font-bold text-ink hover:bg-field" onClick={() => navigator.clipboard.writeText(gps)}>Copy Coordinates</button>
              </div>
            </section>
          </div>
        </Panel>

        <div className="grid gap-5">
          <Panel title="Latest live GPS">
            <div className="grid gap-3">
              <a className="break-words rounded-lg border border-line bg-surfaceMuted p-3 font-semibold text-ink underline decoration-eye decoration-2 underline-offset-4 hover:text-eyeDeep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eye" href={displayOverlay.signedLocationPath}>{displayOverlay.location}</a>
              <p className="text-sm text-muted">Accuracy {displayOverlay.accuracy}</p>
              <p className="break-all text-xs text-muted">Coordinates {gps}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <a className="rounded-md bg-eye px-4 py-3 text-center text-sm font-semibold text-white hover:bg-eyeDeep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eye" href={displayOverlay.signedLocationPath}>Open Live Location</a>
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
                  className={`rounded-lg border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eye ${selectedId === session.id ? "border-eye bg-eye/10 ring-2 ring-eye/30" : "border-line bg-surfaceMuted hover:border-eye/60"}`}
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
        <LocationTrailMap title="Live map marker and movement trail" initialPoints={selected.locationHistory} liveSessionId={selected.id} locationLabel={displayOverlay.location} openLocationHref={displayOverlay.signedLocationPath} />
      </div>
    </>
  );
}
