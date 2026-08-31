"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { humanPriority } from "../lib/admin-presentation";
import { formatReportCapturedAt, reportReporterLabel, reportTypeLabel } from "../lib/report-centre-presentation";
import { clusterReportMapPoints } from "../lib/report-map-clustering";
import type { Incident } from "../lib/types/admin-views";

const mapHeight = 430;
const tileSize = 256;

const markerStyle: Record<string, string> = {
  Emergency: "bg-danger text-white",
  SOS: "bg-danger text-white",
  Crime: "bg-command text-white",
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

function clusterClass(count: number) {
  const size = count >= 25 ? "h-12 min-w-12 text-base" : count >= 10 ? "h-11 min-w-11 text-sm" : "h-10 min-w-10 text-sm";
  const color = count >= 10 ? "bg-warning text-command" : "bg-success text-white";
  return `${size} ${color}`;
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

function fitZoom(reports: Incident[], width: number) {
  let zoom = 17;
  for (; zoom > 3; zoom -= 1) {
    const points = reports.map((report) => worldPoint(report.gps.lat, report.gps.lng, zoom));
    const xSpan = Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x));
    const ySpan = Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));
    if (xSpan <= width * 0.72 && ySpan <= mapHeight * 0.62) break;
  }
  return zoom;
}

function buildMap(reports: Incident[], width: number, zoom: number) {
  if (!reports.length) return null;
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
  const fittedZoom = useMemo(() => validReports.length ? fitZoom(validReports, mapWidth) : 12, [mapWidth, validReports]);
  const [zoomOffset, setZoomOffset] = useState(0);
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
  const zoom = Math.max(3, Math.min(19, fittedZoom + zoomOffset));
  const map = useMemo(() => buildMap(validReports, mapWidth, zoom), [mapWidth, validReports, zoom]);
  const clusters = useMemo(() => clusterReportMapPoints(map?.points ?? []), [map]);
  const selected = validReports.find((report) => report.id === selectedId);

  return (
    <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-semibold text-ink">Live report map</h2><p className="text-sm text-muted">Current reports plotted at their captured locations - nearby reports are grouped until you zoom in.</p></div>
        <span className="text-xs font-semibold text-ink">{validReports.length} mapped</span>
      </div>
      <div className="grid overflow-hidden rounded-lg border border-line xl:grid-cols-[minmax(0,1fr)_320px]">
      <div ref={mapRef} className="relative min-h-[430px] overflow-hidden bg-surfaceMuted" role="group" aria-label="Report Centre map with real report locations">
        {map ? map.tiles.map((tile) => <img key={tile.key} src={tile.url} alt="" aria-hidden="true" className="pointer-events-none absolute h-64 w-64 max-w-none select-none" style={{ left: tile.left, top: tile.top }} />) : <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">No reports with valid coordinates match the current filters.</div>}
        {clusters.map((cluster) => cluster.reports.length > 1 ? (
          <button key={cluster.id} type="button" aria-label={`Zoom into ${cluster.reports.length} grouped reports`} onClick={() => setZoomOffset((value) => Math.min(value + 2, 19 - fittedZoom))} className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white px-2 font-bold shadow-soft focus:outline-none focus:ring-2 focus:ring-eye ${clusterClass(cluster.reports.length)}`} style={{ left: cluster.x, top: cluster.y }}>
            {cluster.reports.length}
          </button>
        ) : (
          <button key={cluster.id} type="button" aria-label={`Open map summary for ${cluster.reports[0].title}`} onClick={() => setSelectedId(cluster.reports[0].id)} className={`absolute grid h-9 min-w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white px-2 text-xs font-bold shadow-soft focus:outline-none focus:ring-2 focus:ring-eye ${markerStyle[cluster.reports[0].type] ?? "bg-info text-white"}`} style={{ left: cluster.x, top: cluster.y }}>
            {markerText(cluster.reports[0].type)}
          </button>
        ))}
        <div className="absolute left-3 top-3 grid gap-1" aria-label="Map zoom controls">
          <button type="button" aria-label="Zoom in" onClick={() => setZoomOffset((value) => Math.min(value + 1, 19 - fittedZoom))} className="grid h-10 w-10 place-items-center rounded-md border border-line bg-surface text-xl font-bold text-ink shadow-soft">+</button>
          <button type="button" aria-label="Zoom out" onClick={() => setZoomOffset((value) => Math.max(value - 1, 3 - fittedZoom))} className="grid h-10 w-10 place-items-center rounded-md border border-line bg-surface text-xl font-bold text-ink shadow-soft">-</button>
        </div>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="absolute bottom-1 right-1 bg-surface/90 px-1.5 py-0.5 text-[10px] text-ink hover:underline">© OpenStreetMap contributors</a>
        {selected ? (
          <aside className="absolute bottom-4 left-3 right-3 max-h-[360px] overflow-y-auto rounded-lg border border-white/15 bg-[#151a22] p-4 text-white shadow-soft sm:right-auto sm:w-80" aria-live="polite">
            <div className="flex items-start gap-3">
              <span className={`grid h-10 min-w-10 place-items-center rounded-md px-2 text-xs font-bold ${markerStyle[selected.type] ?? "bg-info text-white"}`}>{markerText(selected.type)}</span>
              <div className="min-w-0 flex-1"><h3 className="break-words font-semibold text-white">{selected.title}</h3><p className="mt-1 text-xs text-white/65">{reportTypeLabel(selected.type)}</p></div>
              <button type="button" aria-label="Close map summary" onClick={() => setSelectedId(undefined)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-lg text-white/70 hover:bg-white/10 hover:text-white">x</button>
            </div>
            <dl className="mt-4 grid gap-2 text-sm text-white/75">
              <div className="grid grid-cols-[70px_1fr] gap-2"><dt>Reporter</dt><dd className="break-words font-medium text-white">{reportReporterLabel(selected)}</dd></div>
              <div className="grid grid-cols-[70px_1fr] gap-2"><dt>Location</dt><dd className="break-words font-medium text-white">{selected.location}</dd></div>
              <div className="grid grid-cols-[70px_1fr] gap-2"><dt>Captured</dt><dd className="font-medium text-white">{formatReportCapturedAt(selected.createdAt)}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded border border-white/20 px-2 py-1">{reportTypeLabel(selected.type)}</span>
              <span className="rounded border border-danger/70 px-2 py-1 text-red-200">{humanPriority(selected.priority)}</span>
              <span className="rounded border border-success/70 px-2 py-1 text-green-200">{selected.status}</span>
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-white/70">{selected.description || "No summary supplied."}</p>
            <Link href={`/incidents/${selected.id}`} className="mt-4 inline-flex min-h-10 items-center rounded-md bg-eye px-3 py-2 text-sm font-semibold text-white hover:bg-eyeDeep">View Report</Link>
          </aside>
        ) : null}
      </div>
      <aside className="flex min-h-0 flex-col border-t border-line bg-surface xl:h-[430px] xl:border-l xl:border-t-0" aria-label={`Active reports (${validReports.length})`}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h3 className="font-semibold text-ink">Active reports ({validReports.length})</h3>
          <span className="text-xs text-muted">Newest first</span>
        </div>
        {validReports.length ? (
          <div className="min-h-0 divide-y divide-line overflow-y-auto">
            {validReports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => setSelectedId(report.id)}
                className={`grid w-full grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 text-left hover:bg-surfaceMuted ${selectedId === report.id ? "bg-surfaceMuted" : ""}`}
              >
                <span className={`grid h-10 min-w-10 place-items-center rounded-md px-1 text-[11px] font-bold ${markerStyle[report.type] ?? "bg-info text-white"}`}>{markerText(report.type)}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{report.title}</span>
                  <span className="mt-1 block truncate text-xs text-muted">{report.location}</span>
                  <span className="mt-1 block text-xs text-muted">{formatReportCapturedAt(report.createdAt)}</span>
                </span>
                <span className="rounded border border-line px-2 py-1 text-[11px] font-semibold text-ink">{humanPriority(report.priority)}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="p-5 text-sm text-muted">No active reports match the current filters.</p>
        )}
        <a href="#report-table" className="mt-auto border-t border-line px-4 py-3 text-center text-sm font-semibold text-eye hover:bg-surfaceMuted">View all reports</a>
      </aside>
      </div>
    </section>
  );
}
