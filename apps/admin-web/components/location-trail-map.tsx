"use client";

import { useEffect, useMemo, useState } from "react";
import { sanitizeLocationTrail, type LocationPoint } from "../lib/admin-presentation";
import { Panel } from "./ui";

type Props = {
  title: string;
  initialPoints: LocationPoint[];
  incidentId?: string;
  liveSessionId?: string;
  locationLabel?: string;
  openLocationHref?: string;
};

function mapBounds(points: LocationPoint[]) {
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const latitudeMin = Math.min(...latitudes);
  const latitudeMax = Math.max(...latitudes);
  const longitudeMin = Math.min(...longitudes);
  const longitudeMax = Math.max(...longitudes);
  const latitudePadding = Math.max((latitudeMax - latitudeMin) * 0.35, 0.004);
  const longitudePadding = Math.max((longitudeMax - longitudeMin) * 0.35, 0.004);
  return { south: latitudeMin - latitudePadding, north: latitudeMax + latitudePadding, west: longitudeMin - longitudePadding, east: longitudeMax + longitudePadding };
}

export function LocationTrailMap({ title, initialPoints, incidentId, liveSessionId, locationLabel = "Location unavailable", openLocationHref }: Props) {
  const [points, setPoints] = useState(() => sanitizeLocationTrail(initialPoints));

  useEffect(() => setPoints(sanitizeLocationTrail(initialPoints)), [initialPoints]);
  useEffect(() => {
    const path = incidentId
      ? `/api/admin/incidents/${incidentId}/location-history`
      : liveSessionId ? `/api/live-video/sessions/${liveSessionId}/location/history` : null;
    if (!path) return;
    let cancelled = false;
    async function refresh() {
      try {
        const response = await fetch(path!);
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as { data?: Array<Record<string, unknown>> };
        setPoints(sanitizeLocationTrail((payload.data ?? []).map((entry) => ({
          latitude: Number(entry.latitude),
          longitude: Number(entry.longitude),
          accuracyMeters: entry.accuracyMeters == null && entry.accuracy == null ? null : Number(entry.accuracyMeters ?? entry.accuracy),
          capturedAt: String(entry.capturedAt),
        }))));
      } catch {
        // Keep the last authorized trail while polling recovers.
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [incidentId, liveSessionId]);

  const bounds = useMemo(() => points.length ? mapBounds(points) : null, [points]);
  const latest = points.at(-1);
  const mapUrl = bounds && latest
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${bounds.west}%2C${bounds.south}%2C${bounds.east}%2C${bounds.north}&layer=mapnik&marker=${latest.latitude}%2C${latest.longitude}`
    : null;
  const projected = bounds ? points.map((point) => ({
    x: ((point.longitude - bounds.west) / (bounds.east - bounds.west)) * 100,
    y: ((bounds.north - point.latitude) / (bounds.north - bounds.south)) * 100,
  })) : [];

  return (
    <Panel title={title} aside={openLocationHref ? <a href={openLocationHref} className="text-sm font-semibold text-eye hover:underline" target="_blank" rel="noreferrer">Open Location</a> : null}>
      <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-line bg-surfaceMuted" role="group" aria-label={`${title} with real map and movement trail`}>
        {mapUrl ? <iframe title={`${title} road map`} src={mapUrl} className="absolute inset-0 h-full w-full border-0" loading="lazy" /> : <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">No valid location points are available.</div>}
        {projected.length ? (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${projected.length} chronological movement points`}>
            <polyline points={projected.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#009933" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
            {projected.map((point, index) => <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r={index === projected.length - 1 ? 1.5 : 1} fill={index === projected.length - 1 ? "#dc2626" : "#009933"} stroke="white" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />)}
          </svg>
        ) : null}
        <div className="absolute bottom-3 left-3 right-3 max-h-28 overflow-y-auto rounded-md border border-line bg-surface/95 p-3 text-xs shadow-soft">
          <p className="break-words font-semibold text-ink">{locationLabel}</p>
          <p className="mt-1 text-muted">{points.length} trusted point{points.length === 1 ? "" : "s"}; latest marker is red.</p>
          {latest ? <p className="mt-1 text-muted">Captured {new Date(latest.capturedAt).toLocaleString()} · Accuracy {latest.accuracyMeters ? `${latest.accuracyMeters}m` : "unknown"}</p> : null}
        </div>
      </div>
    </Panel>
  );
}
