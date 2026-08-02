import type { DroneMissionView } from "../../lib/types/admin-views";
import { Panel } from "../ui";

function markerStyle(lat: number, lng: number) {
  return {
    left: `${Math.min(92, Math.max(8, ((lng - 3.2) / 0.4) * 100))}%`,
    top: `${Math.min(92, Math.max(8, ((6.7 - lat) / 0.2) * 100))}%`,
  };
}

export function DroneLiveMapPanel({ missions }: { missions: DroneMissionView[] }) {
  const points = missions.flatMap((mission) => {
    const rows: Array<{ key: string; lat: number; lng: number; label: string; tone: "drone" | "target" | "incident" }> = [];
    if (mission.target) {
      rows.push({ key: `${mission.id}-target`, lat: mission.target.lat, lng: mission.target.lng, label: `${mission.missionCode} target`, tone: "target" });
    }
    if (mission.latestTrack && mission.latestTrack.latitude != null && mission.latestTrack.longitude != null) {
      rows.push({
        key: `${mission.id}-track`,
        lat: Number(mission.latestTrack.latitude),
        lng: Number(mission.latestTrack.longitude),
        label: `${mission.missionCode} drone`,
        tone: "drone",
      });
    }
    return rows;
  });

  return (
    <Panel title="Live GPS map" aside={<span className="text-xs text-muted">{missions.length} active missions</span>}>
      <div className="leaflet-grid relative min-h-[420px] overflow-hidden rounded-lg border border-line" role="img" aria-label="Live drone GPS map">
        {points.map((point) => (
          <div
            key={point.key}
            className={`absolute h-4 w-4 rounded-full ring-4 ${
              point.tone === "drone" ? "bg-eye ring-eye/20" : point.tone === "target" ? "bg-warning ring-warning/20" : "bg-danger ring-danger/20"
            }`}
            style={markerStyle(point.lat, point.lng)}
            title={`${point.label} ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`}
          />
        ))}
        <div className="absolute bottom-4 left-4 rounded-lg border border-line bg-surface/95 p-3 shadow-soft">
          <p className="text-sm font-semibold">Operational airspace view</p>
          <p className="mt-1 text-xs text-muted">Blue = drone position · Amber = mission target · Linked incidents open in mission detail.</p>
        </div>
        {!points.length ? <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">No live GPS tracks — launch a mission to populate the map.</p> : null}
      </div>
    </Panel>
  );
}
