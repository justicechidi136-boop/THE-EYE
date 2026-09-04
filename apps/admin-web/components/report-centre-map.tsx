"use client";

import type { LatLngBounds, Map as LeafletMap, MarkerClusterGroup } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { humanPriority } from "../lib/admin-presentation";
import { relativeReportTime, reportReporterLabel, reportTypeLabel } from "../lib/report-centre-presentation";
import type { Incident } from "../lib/types/admin-views";

const markerColors: Record<string, string> = {
  Emergency: "#dc2626",
  SOS: "#dc2626",
  Crime: "#172026",
  Accident: "#ffb300",
  Fire: "#ff9933",
  Kidnapping: "#b42318",
  Abuse: "#009933",
  SuspiciousActivity: "#0284c7",
};

function markerText(type: string) {
  if (type === "SuspiciousActivity") return "SA";
  if (type === "SOS") return "SOS";
  return type.slice(0, 1).toUpperCase();
}

function textElement(tag: keyof HTMLElementTagNameMap, className: string, value: string) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  return element;
}

function popupContent(report: Incident) {
  const root = document.createElement("article");
  root.className = "report-map-popup";
  root.append(
    textElement("p", "report-map-popup__eyebrow", reportTypeLabel(report.type)),
    textElement("h3", "report-map-popup__title", report.title),
  );
  const meta = document.createElement("div");
  meta.className = "report-map-popup__meta";
  meta.append(
    textElement("span", "", `Reporter: ${reportReporterLabel(report)}`),
    textElement("span", "", report.location),
    textElement("span", "", relativeReportTime(report.createdAt)),
  );
  root.append(meta);
  const badges = document.createElement("div");
  badges.className = "report-map-popup__badges";
  [reportTypeLabel(report.type), humanPriority(report.priority), report.status].forEach((label) => {
    badges.append(textElement("span", "report-map-popup__badge", label));
  });
  root.append(badges);
  const action = document.createElement("a");
  action.className = "report-map-popup__action";
  action.href = `/incidents/${encodeURIComponent(report.id)}`;
  action.textContent = "View Report";
  root.append(action);
  return root;
}

export function ReportCentreMap({ reports }: { reports: Incident[] }) {
  const validReports = useMemo(() => reports.filter((report) => Number.isFinite(report.gps.lat) && Number.isFinite(report.gps.lng) && report.gps.lat >= -90 && report.gps.lat <= 90 && report.gps.lng >= -180 && report.gps.lng <= 180 && !(report.gps.lat === 0 && report.gps.lng === 0)), [reports]);
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const clusterRef = useRef<MarkerClusterGroup | null>(null);
  const boundsRef = useRef<LatLngBounds | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !validReports.length) return;
    let disposed = false;
    void (async () => {
      const leafletModule = await import("leaflet");
      await import("leaflet.markercluster");
      if (disposed || !elementRef.current) return;
      const L = leafletModule.default;
      const map = L.map(element, { minZoom: 4, maxZoom: 19, zoomControl: true, scrollWheelZoom: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      const cluster = L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        spiderfyOnMaxZoom: true,
        removeOutsideVisibleBounds: false,
        iconCreateFunction: (group) => L.divIcon({
          className: "",
          html: `<span class="report-map-cluster">${group.getChildCount()}</span>`,
          iconSize: [42, 42],
          iconAnchor: [21, 21],
        }),
      });
      const bounds = L.latLngBounds([]);
      validReports.forEach((report) => {
        const point = L.latLng(report.gps.lat, report.gps.lng);
        bounds.extend(point);
        const marker = L.marker(point, {
          title: report.title,
          icon: L.divIcon({
            className: "",
            html: `<span class="report-map-marker" style="--marker-color:${markerColors[report.type] ?? "#0284c7"}">${markerText(report.type)}</span>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -18],
          }),
        });
        marker.bindPopup(() => popupContent(report), {
          autoPan: true,
          autoPanPadding: [24, 24],
          closeButton: true,
          keepInView: true,
          maxWidth: 320,
        });
        cluster.addLayer(marker);
      });
      map.addLayer(cluster);
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 15 });
      mapRef.current = map;
      clusterRef.current = cluster;
      boundsRef.current = bounds;
      setMapReady(true);
      window.setTimeout(() => map.invalidateSize(), 0);
    })();
    return () => {
      disposed = true;
      setMapReady(false);
      clusterRef.current?.clearLayers();
      mapRef.current?.remove();
      clusterRef.current = null;
      mapRef.current = null;
      boundsRef.current = null;
    };
  }, [validReports]);

  function fitReports() {
    if (mapRef.current && boundsRef.current) mapRef.current.fitBounds(boundsRef.current, { padding: [42, 42], maxZoom: 15 });
  }

  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold text-ink">Live report map</h2><p className="text-sm text-muted">Pan, zoom, or select a cluster to reach reports in scope.</p></div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{validReports.length} mapped</span>
          <button type="button" onClick={fitReports} disabled={!mapReady} className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-ink hover:border-eye disabled:opacity-50">Fit reports</button>
        </div>
      </div>
      {validReports.length ? <div ref={elementRef} className="report-map-leaflet overflow-hidden rounded-lg border border-line" role="application" aria-label="Interactive Report Centre map" /> : <div className="grid min-h-[430px] place-items-center rounded-lg border border-line bg-surfaceMuted p-6 text-center text-sm text-muted">No reports with valid coordinates match the current filters.</div>}
    </section>
  );
}
