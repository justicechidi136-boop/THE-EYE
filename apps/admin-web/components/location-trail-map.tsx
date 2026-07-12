import type { LiveVideoSessionView } from "../lib/types/admin-views";
import { Panel } from "./ui";

type Point = { left: string; top: string; label: string };

function historyToPoints(history: LiveVideoSessionView["locationHistory"]): Point[] {
  if (!history.length) {
    return [
      { left: "48%", top: "52%", label: "Start" },
      { left: "58%", top: "38%", label: "Latest" },
    ];
  }
  return history.map((entry, index) => ({
    left: `${30 + index * 12}%`,
    top: `${40 + (index % 3) * 8}%`,
    label: entry.time,
  }));
}

export function LocationTrailMap({
  title,
  points,
  history,
  openLocationHref,
}: {
  title: string;
  points?: Point[];
  history?: LiveVideoSessionView["locationHistory"];
  openLocationHref?: string;
}) {
  const markers = points ?? (history ? historyToPoints(history) : historyToPoints([]));

  return (
    <Panel
      title={title}
      aside={
        openLocationHref ? (
          <a href={openLocationHref} className="text-sm font-semibold text-eye hover:underline" target="_blank" rel="noreferrer">
            Open Location
          </a>
        ) : null
      }
    >
      <div className="leaflet-grid relative min-h-[280px] overflow-hidden rounded-lg border border-line" role="img" aria-label={`${title} with movement trail`}>
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          <polyline
            points={markers.map((marker, index) => `${120 + index * 80},${80 + (index % 2) * 40}`).join(" ")}
            fill="none"
            stroke="#009933"
            strokeWidth="3"
            strokeDasharray="6 4"
          />
        </svg>
        {markers.map((marker, index) => (
          <div
            key={`${marker.label}-${index}`}
            className={`absolute h-3 w-3 rounded-full ring-4 ${index === markers.length - 1 ? "bg-red-600 ring-red-600/20" : "bg-eye ring-eye/20"}`}
            style={{ left: marker.left, top: marker.top }}
            title={marker.label}
          />
        ))}
        {history?.length ? (
          <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-line bg-surface/95 p-3 text-xs shadow-soft">
            <p className="font-semibold">Movement trail ({history.length} points)</p>
            <div className="mt-2 grid max-h-24 gap-1 overflow-y-auto">
              {history.map((entry) => (
                <p key={`${entry.time}-${entry.gps}`} className="text-muted">{entry.time} — {entry.gps} ({entry.accuracy})</p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
