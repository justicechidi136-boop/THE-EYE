import { AppShell } from "../../../components/app-shell";
import { SafetyAlertsSubnav } from "../../../components/safety-alerts/safety-alerts-subnav";
import { PageHeader, Panel } from "../../../components/ui";
import { fetchDangerZones } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function SafetyAlertsHistoryPage() {
  const zones = await fetchDangerZones();
  const history = zones.filter((zone) => ["AllClear", "Expired", "CancelledFalseReport"].includes(zone.status));

  return (
    <AppShell>
      <PageHeader eyebrow="Safety Alerts" title="Alert history" />
      <SafetyAlertsSubnav />
      <Panel title="Closed zones">
        <div className="grid gap-3">
          {history.length ? history.map((zone) => (
            <div key={zone.id} className="rounded-lg border border-line p-4">
              <p className="font-semibold">{zone.incidentTitle}</p>
              <p className="text-sm text-muted">{zone.status} · confidence {zone.confidence}%</p>
            </div>
          )) : <p className="text-muted">No closed danger zones yet.</p>}
        </div>
      </Panel>
    </AppShell>
  );
}
