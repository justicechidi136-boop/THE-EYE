"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const mapHeight = 360;
const tileSize = 256;

function worldPoint(latitude: number, longitude: number, zoom: number) {
  const worldSize = tileSize * 2 ** zoom;
  const boundedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const latitudeRadians = (boundedLatitude * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + Math.sin(latitudeRadians)) / (1 - Math.sin(latitudeRadians))) / (4 * Math.PI)) * worldSize,
  };
}

function buildMap(points: LocationPoint[], width: number) {
  if (!points.length) return null;
  let zoom = 18;
  for (; zoom > 3; zoom -= 1) {
    const projected = points.map((point) => worldPoint(point.latitude, point.longitude, zoom));
    const xSpan = Math.max(...projected.map((point) => point.x)) - Math.min(...projected.map((point) => point.x));
    const ySpan = Math.max(...projected.map((point) => point.y)) - Math.min(...projected.map((point) => point.y));
    if (xSpan <= width * 0.65 && ySpan <= mapHeight * 0.45) break;
  }

  const projected = points.map((point) => worldPoint(point.latitude, point.longitude, zoom));
  const centerX = (Math.min(...projected.map((point) => point.x)) + Math.max(...projected.map((point) => point.x))) / 2;
  const centerY = (Math.min(...projected.map((point) => point.y)) + Math.max(...projected.map((point) => point.y))) / 2;
  const originX = centerX - width / 2;
  const originY = centerY - mapHeight / 2;
  const tiles: Array<{ key: string; url: string; left: number; top: number }> = [];
  const tileCount = 2 ** zoom;

  for (let tileY = Math.floor(originY / tileSize); tileY <= Math.floor((originY + mapHeight) / tileSize); tileY += 1) {
    if (tileY < 0 || tileY >= tileCount) continue;
    for (let tileX = Math.floor(originX / tileSize); tileX <= Math.floor((originX + width) / tileSize); tileX += 1) {
      const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${zoom}-${tileX}-${tileY}`,
        url: `/api/admin/map-tiles/${zoom}/${wrappedX}/${tileY}`,
        left: tileX * tileSize - originX,
        top: tileY * tileSize - originY,
      });
    }
  }

  return {
    tiles,
    projected: projected.map((point) => ({ x: point.x - originX, y: point.y - originY })),
  };
}

function formatCapturedAt(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

export function LocationTrailMap({ title, initialPoints, incidentId, liveSessionId, locationLabel = "Location unavailable", openLocationHref }: Props) {
  const [points, setPoints] = useState(() => sanitizeLocationTrail(initialPoints));
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapWidth, setMapWidth] = useState(900);

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

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const resize = () => setMapWidth(Math.max(320, Math.round(element.getBoundingClientRect().width)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const latest = points.at(-1);
  const map = useMemo(() => buildMap(points, mapWidth), [mapWidth, points]);

  return (
    <Panel title={title} aside={openLocationHref ? <a href={openLocationHref} className="text-sm font-semibold text-eye hover:underline" target="_blank" rel="noreferrer">Open Location</a> : null}>
      <div ref={mapRef} className="relative min-h-[360px] overflow-hidden rounded-lg border border-line bg-surfaceMuted" role="group" aria-label={`${title} with real map and movement trail`}>
        {map ? map.tiles.map((tile) => <img key={tile.key} src={tile.url} alt="" aria-hidden="true" className="pointer-events-none absolute h-64 w-64 max-w-none select-none" style={{ left: tile.left, top: tile.top }} />) : <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">No valid location points are available.</div>}
        {map?.projected.length ? (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${mapWidth} ${mapHeight}`} preserveAspectRatio="none" aria-label={`${map.projected.length} chronological movement points`}>
            <polyline points={map.projected.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#009933" strokeWidth="4" vectorEffect="non-scaling-stroke" />
            {map.projected.map((point, index) => <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r={index === map.projected.length - 1 ? 9 : 6} fill={index === map.projected.length - 1 ? "#dc2626" : "#009933"} stroke="white" strokeWidth="3" vectorEffect="non-scaling-stroke" />)}
          </svg>
        ) : null}
        {map ? <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="absolute right-1 top-1 bg-surface/90 px-1.5 py-0.5 text-[10px] text-ink hover:underline">© OpenStreetMap contributors</a> : null}
        <div className="absolute bottom-3 left-3 right-3 max-h-28 overflow-y-auto rounded-md border border-line bg-surface/95 p-3 text-xs shadow-soft">
          <p className="break-words font-semibold text-ink">{locationLabel}</p>
          <p className="mt-1 text-muted">{points.length} trusted point{points.length === 1 ? "" : "s"}; latest marker is red.</p>
          {latest ? <p className="mt-1 text-muted">Captured {formatCapturedAt(latest.capturedAt)} · Accuracy {latest.accuracyMeters ? `${latest.accuracyMeters}m` : "unknown"}</p> : null}
        </div>
      </div>
    </Panel>
  );
}
