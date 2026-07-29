import { AppShell } from "../../components/app-shell";
import { SafetyAlertsSubnav } from "../../components/safety-alerts/safety-alerts-subnav";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { fetchDangerZones } from "../../lib/api/data";
import type { DangerZoneView } from "../../lib/types/admin-views";

export const dynamic = "force-dynamic";

export default async function SafetyAlertsPage() {
  const zones = await fetchDangerZones();
  const active = zones.filter((zone: DangerZoneView) => zone.status.startsWith("Active") || zone.status === "Contained" || zone.status === "Monitoring");

  return (
    <AppShell>
      <PageHeader eyebrow="Safety Alerts" title="Active danger zones" action={<StatusBadge tone="danger">{active.length} active</StatusBadge>} />
      <SafetyAlertsSubnav />
      <Panel title="Live danger zones">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-surfaceMuted text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Incident</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Radii (m)</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {zones.length ? zones.map((zone: DangerZoneView) => (
                <tr key={zone.id}>
                  <td className="px-4 py-3 font-semibold">{zone.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{zone.incidentTitle}</td>
                  <td className="px-4 py-3"><StatusBadge tone={zone.status.startsWith("Active") ? "danger" : "warning"}>{zone.status}</StatusBadge></td>
                  <td className="px-4 py-3">{zone.severity}</td>
                  <td className="px-4 py-3">{zone.innerRadiusMeters} / {zone.warningRadiusMeters} / {zone.outerAwarenessRadiusMeters}</td>
                  <td className="px-4 py-3">{zone.confidence}%</td>
                  <td className="px-4 py-3">{zone.expiryTime ? new Date(zone.expiryTime).toLocaleString() : "-"}</td>
                </tr>
              )) : (
                <tr><td className="px-4 py-6 text-muted" colSpan={7}>No danger zones yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
