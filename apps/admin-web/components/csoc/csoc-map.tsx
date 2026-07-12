"use client";

import { useMemo, useState } from "react";
import type { MapMarker } from "../../lib/csoc/map-data";
import { Panel, StatusBadge } from "../ui";

const LAYER_COLORS: Record<string, string> = {
  incident: "bg-red-600 ring-red-600/20",
  post: "bg-amber-500 ring-amber-500/20",
  volunteer: "bg-emerald-600 ring-emerald-600/20",
  patrol: "bg-blue-600 ring-blue-600/20",
  sos: "bg-red-700 ring-red-700/30",
  "live-video": "bg-purple-600 ring-purple-600/20",
  police: "bg-slate-700 ring-slate-700/20",
  smartwatch: "bg-cyan-600 ring-cyan-600/20",
};

type Props = {
  markers: MapMarker[];
  title?: string;
  heightClass?: string;
};

export function CsocMap({ markers, title = "Community GIS map", heightClass = "min-h-[480px]" }: Props) {
  const [selected, setSelected] = useState<MapMarker | null>(null);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set(Object.keys(LAYER_COLORS)));

  const visible = useMemo(
    () => markers.filter((m) => activeLayers.has(m.type)),
    [markers, activeLayers],
  );

  function toggleLayer(type: string) {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  return (
    <Panel title={title}>
      <div className={`leaflet-grid relative rounded-lg border border-line ${heightClass}`}>
        {visible.map((marker, index) => {
          const left = `${18 + ((marker.lng + 180) % 60)}%`;
          const top = `${22 + ((marker.lat + 90) % 50)}%`;
          const color = LAYER_COLORS[marker.type] ?? "bg-eye ring-eye/20";
          return (
            <button
              key={`${marker.id}-${index}`}
              type="button"
              className={`absolute h-3 w-3 rounded-full ring-4 ${color}`}
              style={{ left, top }}
              title={marker.label}
              aria-label={`${marker.type}: ${marker.label}`}
              onClick={() => setSelected(marker)}
            />
          );
        })}
        <div className="absolute bottom-4 left-4 max-w-sm rounded-lg border border-line bg-surface/95 p-3 shadow-soft">
          <p className="font-semibold">Map layers</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.keys(LAYER_COLORS).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => toggleLayer(type)}
                className={`rounded-md border px-2 py-1 text-xs font-semibold capitalize ${
                  activeLayers.has(type) ? "border-eye bg-emerald-50 text-eye" : "border-line bg-surfaceMuted text-muted"
                }`}
              >
                {type.replace("-", " ")}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">{visible.length} markers visible</p>
        </div>
        {selected ? (
          <aside className="absolute right-4 top-4 w-72 rounded-lg border border-line bg-surface p-4 shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase text-muted">{selected.type}</p>
                <p className="font-semibold">{selected.label}</p>
              </div>
              <button type="button" className="text-sm text-muted hover:text-ink" onClick={() => setSelected(null)} aria-label="Close detail panel">
                ✕
              </button>
            </div>
            {selected.status ? <div className="mt-2"><StatusBadge tone="info">{selected.status}</StatusBadge></div> : null}
            {selected.detail ? <p className="mt-2 text-sm text-muted">{selected.detail}</p> : null}
            <p className="mt-2 text-xs text-muted">
              {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
            </p>
          </aside>
        ) : null}
      </div>
    </Panel>
  );
}
