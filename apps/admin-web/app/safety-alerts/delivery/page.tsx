import { AppShell } from "../../../components/app-shell";
import { SafetyAlertsSubnav } from "../../../components/safety-alerts/safety-alerts-subnav";
import { PageHeader, Panel } from "../../../components/ui";
import { fetchDangerZones } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function SafetyAlertsDeliveryPage() {
  const zones = await fetchDangerZones();

  return (
    <AppShell>
      <PageHeader eyebrow="Safety Alerts" title="Delivery monitoring" />
      <SafetyAlertsSubnav />
      <Panel title="Zone delivery overview">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surfaceMuted text-xs uppercase text-muted">
              <tr><th className="px-4 py-3">Zone</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Severity</th><th className="px-4 py-3">Affected estimate</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {zones.map((zone) => (
                <tr key={zone.id}>
                  <td className="px-4 py-3 font-semibold">{zone.incidentTitle}</td>
                  <td className="px-4 py-3">{zone.status}</td>
                  <td className="px-4 py-3">{zone.severity}</td>
                  <td className="px-4 py-3">{zone.affectedCount ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
