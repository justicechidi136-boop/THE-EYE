import Link from "next/link";
import type { DroneMissionView } from "../../lib/types/admin-views";
import { EmptyState, TableScrollHint } from "../form-primitives";
import { StatusBadge } from "../ui";

function missionTone(status: string) {
  if (status === "Active") return "success";
  if (status === "Scheduled" || status === "Preflight") return "info";
  if (status === "Paused") return "warning";
  if (status === "Failed" || status === "Aborted") return "danger";
  return "neutral";
}

export function DroneMissionTable({ missions }: { missions: DroneMissionView[] }) {
  if (!missions.length) {
    return (
      <EmptyState
        title="No drone missions yet"
        description="Schedule a mission, launch from an incident, or assign a drone from the fleet to begin aerial surveillance."
      />
    );
  }

  return (
    <div>
      <TableScrollHint />
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-surfaceMuted text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Mission</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Drone</th>
              <th className="px-4 py-3">Incident</th>
              <th className="px-4 py-3">Target GPS</th>
              <th className="px-4 py-3">Live video</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {missions.map((mission) => (
              <tr key={mission.id} className="align-top hover:bg-surfaceMuted">
                <td className="px-4 py-3">
                  <Link href={`/drone-surveillance/missions/${mission.id}`} className="font-semibold text-eye hover:underline">
                    {mission.missionCode}
                  </Link>
                  <p className="mt-1 text-xs text-muted">{mission.title}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone={missionTone(mission.status)}>{mission.status}</StatusBadge>
                </td>
                <td className="px-4 py-3 text-muted">{mission.drone?.deviceId ?? "Unassigned"}</td>
                <td className="px-4 py-3">
                  {mission.incident ? (
                    <Link href={`/incidents/${mission.incident.id}`} className="text-eye hover:underline">
                      {mission.incident.title}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-muted">
                  {mission.target ? `${mission.target.lat.toFixed(5)}, ${mission.target.lng.toFixed(5)}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone={mission.liveVideoStatus === "Live" ? "success" : "neutral"}>{mission.liveVideoStatus}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
