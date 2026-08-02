import Link from "next/link";
import type { DroneDeviceView } from "../../lib/types/admin-views";
import { EmptyState, TableScrollHint } from "../form-primitives";
import { StatusBadge } from "../ui";

export function DroneFleetTable({ devices }: { devices: DroneDeviceView[] }) {
  if (!devices.length) {
    return (
      <EmptyState
        title="No drones registered"
        description="Register fleet assets with device ID, model, and telemetry endpoints to begin mission dispatch."
      />
    );
  }

  return (
    <div>
      <TableScrollHint />
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead className="bg-surfaceMuted text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Health</th>
              <th className="px-4 py-3">Battery</th>
              <th className="px-4 py-3">Signal</th>
              <th className="px-4 py-3">Missions</th>
              <th className="px-4 py-3">Last GPS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {devices.map((device) => (
              <tr key={device.id} className="align-top hover:bg-surfaceMuted">
                <td className="px-4 py-3">
                  <p className="font-semibold">{device.deviceId}</p>
                  <p className="text-xs text-muted">{device.manufacturer} {device.model}</p>
                </td>
                <td className="px-4 py-3"><StatusBadge tone={device.status === "Active" ? "success" : "warning"}>{device.status}</StatusBadge></td>
                <td className="px-4 py-3"><StatusBadge tone={device.healthStatus === "Healthy" ? "success" : "warning"}>{device.healthStatus}</StatusBadge></td>
                <td className="px-4 py-3">{device.batteryLevel != null ? `${device.batteryLevel}%` : "—"}</td>
                <td className="px-4 py-3">{device.signalStrength != null ? `${device.signalStrength}%` : "—"}</td>
                <td className="px-4 py-3">{device.totalMissions}</td>
                <td className="px-4 py-3 text-muted">
                  {device.lastGps ? (
                    <a className="text-eye" href={`https://www.google.com/maps/search/?api=1&query=${device.lastGps.lat},${device.lastGps.lng}`}>
                      {device.lastGps.lat.toFixed(4)}, {device.lastGps.lng.toFixed(4)}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
