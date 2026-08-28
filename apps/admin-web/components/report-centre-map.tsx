"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { humanPriority } from "../lib/admin-presentation";
import { formatReportCapturedAt, reportReporterLabel, reportTypeLabel } from "../lib/report-centre-presentation";
import type { Incident } from "../lib/types/admin-views";

const mapHeight = 430;
const tileSize = 256;

const markerStyle: Record<string, string> = {
  Emergency: "bg-danger text-white",
  SOS: "bg-danger text-white",
  Crime: "bg-ink text-surface",
  Accident: "bg-warning text-ink",
  Fire: "bg-eyeOrange text-white",
  Kidnapping: "bg-danger text-white",
  Abuse: "bg-eye text-white",
  SuspiciousActivity: "bg-info text-white",
};

function markerText(type: string) {
  if (type === "SuspiciousActivity") return "SA";
  if (type === "SOS") return "SOS";
  return type.slice(0, 1).toUpperCase();
}
function worldPoint(latitude: number, longitude: number, zoom: number) {
  const worldSize = tileSize * 2 ** zoom;
  const boundedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const latitudeRadians = (boundedLatitude * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + Math.sin(latitudeRadians)) / (1 - Math.sin(latitudeRadians))) / (4 * Math.PI)) * worldSize,
  };
}

function buildMap(reports: Incident[], width: number) {
  if (!reports.length) return null;
  let zoom = 17;
  for (; zoom > 3; zoom -= 1) {
    const points = reports.map((report) => worldPoint(report.gps.lat, report.gps.lng, zoom));
    const xSpan = Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x));
    const ySpan = Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));
    if (xSpan <= width * 0.72 && ySpan <= mapHeight * 0.62) break;
  }
  const points = reports.map((report) => worldPoint(report.gps.lat, report.gps.lng, zoom));
  const centerX = (Math.min(...points.map((point) => point.x)) + Math.max(...points.map((point) => point.x))) / 2;
  const centerY = (Math.min(...points.map((point) => point.y)) + Math.max(...points.map((point) => point.y))) / 2;
  const originX = centerX - width / 2;
  const originY = centerY - mapHeight / 2;
  const tiles: Array<{ key: string; url: string; left: number; top: number }> = [];
  const tileCount = 2 ** zoom;
  for (let tileY = Math.floor(originY / tileSize); tileY <= Math.floor((originY + mapHeight) / tileSize); tileY += 1) {
    if (tileY < 0 || tileY >= tileCount) continue;
    for (let tileX = Math.floor(originX / tileSize); tileX <= Math.floor((originX + width) / tileSize); tileX += 1) {
      const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
      tiles.push({ key: `${zoom}-${tileX}-${tileY}`, url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`, left: tileX * tileSize - originX, top: tileY * tileSize - originY });
    }
  }
  return { tiles, points: points.map((point, index) => ({ report: reports[index], x: point.x - originX, y: point.y - originY })) };
}

export function ReportCentreMap({ reports }: { reports: Incident[] }) {
  const validReports = useMemo(() => reports.filter((report) => Number.isFinite(report.gps.lat) && Number.isFinite(report.gps.lng) && report.gps.lat >= -90 && report.gps.lat <= 90 && report.gps.lng >= -180 && report.gps.lng <= 180 && !(report.gps.lat === 0 && report.gps.lng === 0)), [reports]);
  const [selectedId, setSelectedId] = useState<string>();
  const [mapWidth, setMapWidth] = useState(900);
  const mapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const resize = () => setMapWidth(Math.max(300, Math.round(element.getBoundingClientRect().width)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const map = useMemo(() => buildMap(validReports, mapWidth), [mapWidth, validReports]);
  const selected = validReports.find((report) => report.id === selectedId);

  return (
    <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-semibold text-ink">Live report map</h2><p className="text-sm text-muted">Current reports plotted at their captured locations.</p></div>
        <span className="text-xs text-muted">{validReports.length} mapped</span>
      </div>
      <div ref={mapRef} className="relative min-h-[430px] overflow-hidden rounded-lg border border-line bg-surfaceMuted" role="group" aria-label="Report Centre map with real report locations">
        {map ? map.tiles.map((tile) => <img key={tile.key} src={tile.url} alt="" aria-hidden="true" className="pointer-events-none absolute h-64 w-64 max-w-none select-none" style={{ left: tile.left, top: tile.top }} />) : <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">No reports with valid coordinates match the current filters.</div>}
        {map?.points.map(({ report, x, y }) => (
          <button key={report.id} type="button" aria-label={`Open map summary for ${report.title}`} onClick={() => setSelectedId(report.id)} className={`absolute grid h-9 min-w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white px-2 text-xs font-bold shadow-soft focus:outline-none focus:ring-2 focus:ring-eye ${markerStyle[report.type] ?? "bg-info text-white"}`} style={{ left: x, top: y }}>
            {markerText(report.type)}
          </button>
        ))}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="absolute bottom-1 right-1 bg-surface/90 px-1.5 py-0.5 text-[10px] text-ink hover:underline">© OpenStreetMap contributors</a>
        {selected ? (
          <aside className="absolute left-3 right-3 top-3 max-h-[390px] overflow-y-auto rounded-lg border border-line bg-surface/95 p-4 shadow-soft sm:left-auto sm:w-80" aria-live="polite">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase text-eye">{reportTypeLabel(selected.type)}</p><h3 className="mt-1 break-words font-semibold text-ink">{selected.title}</h3></div><button type="button" aria-label="Close map summary" onClick={() => setSelectedId(undefined)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-lg text-muted">×</button></div>
            <p className="mt-2 line-clamp-2 text-sm text-muted">{selected.description || "No summary supplied."}</p>
            <dl className="mt-3 grid gap-2 text-xs"><div><dt className="text-muted">Reporter</dt><dd className="break-words font-medium text-ink">{reportReporterLabel(selected)}</dd></div><div><dt className="text-muted">Location</dt><dd className="break-words font-medium text-ink">{selected.location}</dd></div><div><dt className="text-muted">Captured</dt><dd className="font-medium text-ink">{formatReportCapturedAt(selected.createdAt)}</dd></div><div className="flex gap-4"><span><span className="text-muted">Priority </span><strong>{humanPriority(selected.priority)}</strong></span><span><span className="text-muted">Status </span><strong>{selected.status}</strong></span></div></dl>
            <Link href={`/incidents/${selected.id}`} className="mt-4 inline-flex rounded-md bg-eye px-3 py-2 text-sm font-semibold text-white hover:bg-eyeDeep">View Report</Link>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
