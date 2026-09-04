"use client";

import type { Map as LeafletMap } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";

type BroadcastMapMarker = { id: string; latitude: number; longitude: number; label: string };
const emptyMarkers: BroadcastMapMarker[] = [];

function validCoordinate(latitude: number | null, longitude: number | null) {
  return latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
    && !(latitude === 0 && longitude === 0);
}

function markerIcon(index: number | null) {
  const label = index == null ? "!" : String(index + 1);
  const color = index == null ? "#b42318" : "#ff9933";
  return `<span class="report-map-marker" style="--marker-color:${color}">${label}</span>`;
}

export function BroadcastDetailMap({ latitude, longitude, location, radiusMeters, markers = emptyMarkers, title = "Target location", description, showCenterMarker = true, showOpenLocation = true, embedded = false }: {
  latitude: number | null;
  longitude: number | null;
  location: string;
  radiusMeters: number | null;
  markers?: BroadcastMapMarker[];
  title?: string;
  description?: string;
  showCenterMarker?: boolean;
  showOpenLocation?: boolean;
  embedded?: boolean;
}) {
  const validCenter = validCoordinate(latitude, longitude);
  const validMarkers = useMemo(() => markers.filter((marker) => validCoordinate(marker.latitude, marker.longitude)), [markers]);
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || (!validCenter && !validMarkers.length)) return;
    let disposed = false;
    setMapError(null);
    void (async () => {
      const leafletModule = await import("leaflet");
      if (disposed || !elementRef.current) return;
      const L = leafletModule.default;
      const map = L.map(elementRef.current, { minZoom: 4, maxZoom: 19, zoomControl: true, scrollWheelZoom: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 19 }).addTo(map);
      const bounds = L.latLngBounds([]);

      if (validCenter) {
        const center = L.latLng(latitude!, longitude!);
        bounds.extend(center);
        if (showCenterMarker) {
          L.marker(center, {
            title: location,
            icon: L.divIcon({ className: "", html: markerIcon(null), iconSize: [40, 40], iconAnchor: [20, 20] }),
          }).bindTooltip(location, { direction: "top", offset: [0, -18] }).addTo(map);
        }
        if (radiusMeters && radiusMeters > 0) {
          const latitudeDelta = radiusMeters / 111_320;
          const longitudeDelta = radiusMeters / (111_320 * Math.max(0.2, Math.cos((latitude! * Math.PI) / 180)));
          bounds.extend([latitude! - latitudeDelta, longitude! - longitudeDelta]);
          bounds.extend([latitude! + latitudeDelta, longitude! + longitudeDelta]);
          L.circle(center, { radius: radiusMeters, color: "#ff9933", fillColor: "#ff9933", fillOpacity: 0.08, weight: 2 }).addTo(map);
        }
      }

      validMarkers.forEach((marker, index) => {
        const point = L.latLng(marker.latitude, marker.longitude);
        bounds.extend(point);
        L.marker(point, {
          title: marker.label,
          icon: L.divIcon({ className: "", html: markerIcon(index), iconSize: [40, 40], iconAnchor: [20, 20] }),
        }).bindTooltip(marker.label, { direction: "top", offset: [0, -18] }).on("click", () => {
          document.getElementById(`sighting-${marker.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }).addTo(map);
      });

      if (bounds.isValid()) map.fitBounds(bounds, { padding: [38, 38], maxZoom: radiusMeters ? 15 : 16 });
      mapRef.current = map;
      setMapReady(true);
      window.setTimeout(() => map.invalidateSize(), 0);
    })().catch((error: unknown) => {
      if (disposed) return;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapError(error instanceof Error ? error.message : "The map could not be initialized.");
    });
    return () => {
      disposed = true;
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [latitude, location, longitude, radiusMeters, showCenterMarker, validCenter, validMarkers]);

  const content = <>
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="font-semibold text-ink">{title}</h2><p className="mt-1 break-words text-sm text-muted">{location}</p>{description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}</div>
      {showOpenLocation && validCenter ? <a className="shrink-0 text-sm font-semibold text-eye hover:underline" href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`} target="_blank" rel="noreferrer">Open Location</a> : null}
    </div>
    {validCenter || validMarkers.length ? <div className="relative">
      <div ref={elementRef} className="report-map-leaflet min-h-[360px] overflow-hidden rounded-lg border border-line" role="application" aria-label={`Interactive ${title.toLowerCase()} map`} />
      {mapError ? <div className="absolute inset-0 z-[600] grid place-items-center bg-surfaceMuted p-6 text-center text-sm text-danger">Map unavailable: {mapError}</div> : null}
      <div className="pointer-events-none absolute bottom-2 left-2 z-[500] rounded bg-surface/95 px-2 py-1 text-xs text-ink shadow-sm">{radiusMeters ? `Delivery radius: ${(radiusMeters / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km` : "Geographic scope follows the saved target"}</div>
    </div> : <div className="grid min-h-[360px] place-items-center rounded-lg border border-line bg-surfaceMuted p-6 text-center text-sm text-muted">A geographic target was not captured for this broadcast.</div>}
    <span className="sr-only" aria-live="polite">{mapReady ? "Interactive map ready" : "Loading map"}</span>
  </>;

  return embedded ? <div className="min-w-0">{content}</div> : <section className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-sm">{content}</section>;
}
