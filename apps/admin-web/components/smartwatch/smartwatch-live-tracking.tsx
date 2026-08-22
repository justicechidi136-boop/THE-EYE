"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  smartwatchLocationFreshness,
  toSmartwatchTrackingLocation,
  type SmartwatchTrackingLocation,
} from "../../lib/smartwatch-live-tracking";
import type { SosEventView } from "../../lib/types/admin-views";
import { Panel, StatusBadge } from "../ui";

const POLL_INTERVAL_MS = 5000;

function mapsUrl(location: SmartwatchTrackingLocation) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`;
}

export function SmartwatchLiveTracking({ events }: { events: SosEventView[] }) {
  const active = useMemo(() => events.filter((event) => event.status === "Active"), [events]);
  const [selectedId, setSelectedId] = useState(active[0]?.id ?? "");
  const [location, setLocation] = useState<SmartwatchTrackingLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const selected = active.find((event) => event.id === selectedId) ?? active[0] ?? null;

  useEffect(() => {
    if (!selected) {
      setLocation(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let disposed = false;
    let inFlight = false;
    async function refresh() {
      if (inFlight) return;
      inFlight = true;
      setRefreshing(true);
      try {
        const response = await fetch(
          `/api/admin/smartwatch/sos-events/${encodeURIComponent(selected.id)}/tracking`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(payload.message ?? "Live location refresh failed");
        if (disposed) return;
        setLocation(toSmartwatchTrackingLocation(payload));
        setError(null);
      } catch (refreshError) {
        if (disposed || controller.signal.aborted) return;
        setError(refreshError instanceof Error ? refreshError.message : "Live location refresh failed");
      } finally {
        inFlight = false;
        if (!disposed) setRefreshing(false);
      }
    }

    setLocation(null);
    setError(null);
    void refresh();
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [selected]);

  const freshness = smartwatchLocationFreshness(location?.capturedAt ?? null);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <Panel title="Active emergency positions">
        <div className="grid min-h-[420px] gap-3 content-start">
          {active.length ? active.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => setSelectedId(event.id)}
              className={`rounded-lg border p-4 text-left ${selected?.id === event.id ? "border-eye bg-eye/5" : "border-line bg-surfaceMuted"}`}
            >
              <p className="font-semibold">{event.deviceId}</p>
              <p className="text-sm text-muted">{event.incidentId} · {event.sourceMode}</p>
            </button>
          )) : <p className="text-muted">No active smartwatch SOS events are currently available.</p>}

          {selected ? (
            <div className="rounded-lg border border-line p-4" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Latest authorized position</p>
                <StatusBadge tone={freshness === "Live" ? "success" : freshness === "Stale" ? "warning" : "neutral"}>
                  {refreshing ? "Refreshing" : freshness}
                </StatusBadge>
              </div>
              {location ? (
                <>
                  <p className="mt-2 text-sm">{location.latitude}, {location.longitude}</p>
                  <p className="text-xs text-muted">
                    {location.capturedAt ? `Captured ${new Date(location.capturedAt).toLocaleString()}` : "Capture time unavailable"}
                    {location.accuracyMeters === null ? " · accuracy unavailable" : ` · accuracy ${location.accuracyMeters}m`}
                  </p>
                  <a className="mt-3 inline-block font-semibold text-eye" href={mapsUrl(location)} target="_blank" rel="noreferrer">
                    Open live position
                  </a>
                </>
              ) : <p className="mt-2 text-sm text-muted">GPS position is unavailable.</p>}
              {error ? (
                <div role="alert" className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                  {error} The last known position is retained; refresh will retry automatically.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel title="All recent tracks">
        <div className="grid gap-3">
          {events.length ? events.map((event) => (
            <div key={event.id} className="rounded-lg border border-line bg-surfaceMuted p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/devices/smart-watches/${event.deviceId}`} className="font-semibold text-eye hover:underline">{event.deviceId}</Link>
                  <p className="text-sm text-muted">{event.incidentId} · {event.sourceMode}</p>
                </div>
                <StatusBadge tone={event.status === "Active" ? "danger" : "success"}>{event.status}</StatusBadge>
              </div>
              <p className="mt-2 text-xs text-muted">SOS triggered {event.triggeredAt}</p>
            </div>
          )) : <p className="text-muted">No recent smartwatch tracks are available.</p>}
        </div>
      </Panel>
    </div>
  );
}
